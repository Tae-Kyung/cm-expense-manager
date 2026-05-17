import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);

    // 필터 파라미터
    const yearMonths = searchParams.get("yearMonths"); // 쉼표 구분
    const sections = searchParams.get("sections"); // general,finance,income,excluded
    const 계정Filter = searchParams.get("계정");
    const 계정과목Filter = searchParams.get("계정과목");
    const 제품명Filter = searchParams.get("제품명");
    const 담당자Filter = searchParams.get("담당자");
    const 구분Filter = searchParams.get("구분");

    // 1. 사용 가능한 년월 목록 조회
    const { data: uploads } = await supabase
      .from("mgmt_uploads")
      .select("year_month")
      .order("year_month", { ascending: true });

    const availableMonths = [...new Set((uploads || []).map((u) => u.year_month))];

    // 2. 거래 내역 조회 (필터 적용)
    let query = supabase
      .from("mgmt_transactions")
      .select("*, mgmt_uploads!inner(year_month)");

    if (yearMonths) {
      const months = yearMonths.split(",");
      query = query.in("mgmt_uploads.year_month", months);
    }

    if (sections) {
      query = query.in("section", sections.split(","));
    } else {
      // 기본: 일반경비 + 금융수수료만
      query = query.in("section", ["general", "finance"]);
    }

    if (계정Filter) query = query.eq("계정", 계정Filter);
    if (계정과목Filter) query = query.eq("계정과목", 계정과목Filter);
    if (제품명Filter) query = query.eq("제품명", 제품명Filter);
    if (담당자Filter) query = query.eq("담당자", 담당자Filter);
    if (구분Filter) query = query.eq("구분", 구분Filter);

    const { data: transactions, error } = await query as { data: Record<string, any>[] | null; error: any };

    if (error) {
      throw new Error(error.message);
    }

    // 3. 고유값 목록 (필터 옵션용)
    const { data: allTx } = await supabase
      .from("mgmt_transactions")
      .select("*")
      .limit(5000);

    const allTxAny = (allTx || []) as Record<string, unknown>[];
    const uniqueValues = {
      계정: [...new Set(allTxAny.map((t) => t["계정"] as string).filter(Boolean))].sort(),
      계정과목: [...new Set(allTxAny.map((t) => t["계정과목"] as string).filter(Boolean))].sort(),
      제품명: [...new Set(allTxAny.map((t) => t["제품명"] as string).filter(Boolean))].sort(),
      담당자: [...new Set(allTxAny.map((t) => t["담당자"] as string).filter(Boolean))].sort(),
      구분: [...new Set(allTxAny.map((t) => t["구분"] as string).filter(Boolean))].sort(),
    };

    // 4. 집계 계산
    const txList = (transactions || []).map((t: Record<string, any>) => ({
      year_month: t.mgmt_uploads?.year_month || "",
      계정: t["계정"] || "",
      계정과목: t["계정과목"] || "",
      제품명: t["제품명"] || "",
      담당자: t["담당자"] || "",
      구분: t["구분"] || "",
      입금: Number(t["입금"]) || 0,
      출금: Number(t["출금"]) || 0,
      section: t.section || "",
    }));

    // 다차원 집계
    const aggregations = {
      byMonth: aggregate(txList, "year_month"),
      by계정: aggregate(txList, "계정"),
      by계정과목: aggregate(txList, "계정과목"),
      by제품명: aggregate(txList, "제품명"),
      by담당자: aggregate(txList, "담당자"),
      by구분: aggregate(txList, "구분"),
    };

    // 총계
    const totals = {
      입금합계: txList.reduce((s, t) => s + t.입금, 0),
      출금합계: txList.reduce((s, t) => s + t.출금, 0),
      건수: txList.length,
    };

    return Response.json({
      availableMonths,
      uniqueValues,
      aggregations,
      totals,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "분석 데이터 조회 실패";
    return Response.json({ error: message }, { status: 500 });
  }
}

interface TxItem {
  year_month: string;
  계정: string;
  계정과목: string;
  제품명: string;
  담당자: string;
  구분: string;
  입금: number;
  출금: number;
  section: string;
}

interface AggRow {
  key: string;
  입금: number;
  출금: number;
  건수: number;
}

function aggregate(txList: TxItem[], field: keyof TxItem): AggRow[] {
  const map: Record<string, { 입금: number; 출금: number; 건수: number }> = {};

  for (const t of txList) {
    const key = String(t[field]) || "(없음)";
    if (!map[key]) map[key] = { 입금: 0, 출금: 0, 건수: 0 };
    map[key].입금 += t.입금;
    map[key].출금 += t.출금;
    map[key].건수 += 1;
  }

  return Object.entries(map)
    .map(([key, val]) => ({ key, ...val }))
    .sort((a, b) => b.출금 - a.출금);
}

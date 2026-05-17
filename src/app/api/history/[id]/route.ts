import { getSupabase } from "@/lib/supabase";
import type { Transaction, SummaryRow, TransformResult } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 종합 요약에 사용되는 고정 계정 카테고리 */
const SUMMARY_CATEGORIES = [
  "A/S비", "감가상각비", "경상연구개발비", "광고선전비", "교육훈련비",
  "교통비", "국내출장비", "도서인쇄비", "보험료", "복리후생비",
  "세금과공과", "소모품비", "수도광열비", "수선비", "운반비",
  "접대비", "지급수수료", "차량관리비", "통신비", "해외출장비",
  "판매촉진비", "폐기비용", "원재료비", "노무비", "자산구입비",
  "지급임차료", "협회비", "기타",
] as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = getSupabase();

    // 업로드 정보 조회
    const { data: upload, error: uploadError } = await supabase
      .from("mgmt_uploads")
      .select("*")
      .eq("id", id)
      .single();

    if (uploadError || !upload) {
      return Response.json({ error: "데이터를 찾을 수 없습니다." }, { status: 404 });
    }

    // 거래 내역 조회
    const { data: transactions, error: txError } = await supabase
      .from("mgmt_transactions")
      .select("*")
      .eq("upload_id", id)
      .order("created_at", { ascending: true });

    if (txError) {
      throw new Error(txError.message);
    }

    // 섹션별 분류
    const general: Transaction[] = [];
    const finance: Transaction[] = [];
    const income: Transaction[] = [];
    const excluded: Transaction[] = [];

    for (const row of transactions || []) {
      const tx: Transaction = {
        관리번호: row.관리번호,
        발행일: row.발행일 || "",
        계정: row.계정 || "",
        코드: row.코드 || "",
        계정과목: row.계정과목 || "",
        제품명: row.제품명 || "",
        세부내용: row.세부내용 || "",
        입금: row.입금 || 0,
        출금: row.출금 || 0,
        담당자: row.담당자 || "",
        구분: row.구분 || "",
        비고: row.비고 || "",
      };

      switch (row.section) {
        case "finance": finance.push(tx); break;
        case "income": income.push(tx); break;
        case "excluded": excluded.push(tx); break;
        default: general.push(tx); break;
      }
    }

    // 일반경비 정렬
    general.sort((a, b) => {
      const cmp = a.계정.localeCompare(b.계정, "ko");
      if (cmp !== 0) return cmp;
      return a.발행일.localeCompare(b.발행일);
    });

    // 종합 요약 생성
    const summary = buildSummary(general, finance);

    const result: TransformResult = {
      sheetName: upload.year_month,
      general,
      finance,
      income,
      summary,
      generalTotal: general.reduce((s, tx) => s + tx.출금, 0),
      financeTotal: finance.reduce((s, tx) => s + tx.출금, 0),
      incomeTotal: income.reduce((s, tx) => s + tx.입금, 0),
    };

    return Response.json({ upload, result, excluded });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

function buildSummary(general: Transaction[], finance: Transaction[]): SummaryRow[] {
  const pivot: Record<string, { 합계: number; 공장: number; 영업: number; 연구소: number }> = {};

  for (const cat of SUMMARY_CATEGORIES) {
    pivot[cat] = { 합계: 0, 공장: 0, 영업: 0, 연구소: 0 };
  }

  for (const tx of general) {
    const cat = pivot[tx.계정] ? tx.계정 : "기타";
    pivot[cat].합계 += tx.출금;
    if (tx.구분 === "공장" || tx.구분 === "공통") pivot[cat].공장 += tx.출금;
    else if (tx.구분 === "영업") pivot[cat].영업 += tx.출금;
    else if (tx.구분 === "연구소") pivot[cat].연구소 += tx.출금;
    else pivot[cat].공장 += tx.출금;
  }

  const rows: SummaryRow[] = SUMMARY_CATEGORIES.map((cat) => ({
    종합: cat, 합계: pivot[cat].합계, 공장: pivot[cat].공장, 영업: pivot[cat].영업, 연구소: pivot[cat].연구소,
  }));

  const exFinance: SummaryRow = {
    종합: "금융료제외 합계",
    합계: rows.reduce((s, r) => s + r.합계, 0),
    공장: rows.reduce((s, r) => s + r.공장, 0),
    영업: rows.reduce((s, r) => s + r.영업, 0),
    연구소: rows.reduce((s, r) => s + r.연구소, 0),
  };

  const finSummary: SummaryRow = {
    종합: "금융수수료",
    합계: finance.reduce((s, tx) => s + tx.출금, 0),
    공장: finance.filter((tx) => tx.구분 === "공장").reduce((s, tx) => s + tx.출금, 0),
    영업: finance.filter((tx) => tx.구분 === "영업").reduce((s, tx) => s + tx.출금, 0),
    연구소: finance.filter((tx) => tx.구분 === "연구소").reduce((s, tx) => s + tx.출금, 0),
  };

  const incFinance: SummaryRow = {
    종합: "금융료포함 합계",
    합계: exFinance.합계 + finSummary.합계,
    공장: exFinance.공장 + finSummary.공장,
    영업: exFinance.영업 + finSummary.영업,
    연구소: exFinance.연구소 + finSummary.연구소,
  };

  rows.push(exFinance, finSummary, incFinance);
  return rows;
}

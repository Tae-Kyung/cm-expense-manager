import { getSupabase } from "@/lib/supabase";
import { processFile } from "@/lib/process-file";
import type { Transaction } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const { result, excluded } = processFile(buffer);

    const supabase = getSupabase();

    // 1. uploads 레코드 생성
    const { data: upload, error: uploadError } = await supabase
      .from("mgmt_uploads")
      .insert({
        year_month: result.sheetName,
        file_name: file.name,
        file_size: file.size,
        status: "processed",
        general_count: result.general.length,
        finance_count: result.finance.length,
        income_count: result.income.length,
        excluded_count: excluded.length,
        general_total: result.generalTotal,
        finance_total: result.financeTotal,
        income_total: result.incomeTotal,
      })
      .select("id")
      .single();

    if (uploadError) {
      throw new Error(`업로드 저장 실패: ${uploadError.message}`);
    }

    // 2. transactions 저장 (배치)
    const allTransactions: Array<
      Omit<Transaction, never> & { upload_id: string; section: string }
    > = [];

    const addBatch = (txs: Transaction[], section: string) => {
      for (const tx of txs) {
        allTransactions.push({ ...tx, upload_id: upload.id, section });
      }
    };

    addBatch(result.general, "general");
    addBatch(result.finance, "finance");
    addBatch(result.income, "income");
    addBatch(excluded, "excluded");

    // Supabase는 한번에 최대 1000건, 배치 분할
    const BATCH_SIZE = 500;
    for (let i = 0; i < allTransactions.length; i += BATCH_SIZE) {
      const batch = allTransactions.slice(i, i + BATCH_SIZE);
      const { error: txError } = await supabase
        .from("mgmt_transactions")
        .insert(batch);

      if (txError) {
        // 실패 시 upload도 삭제
        await supabase.from("mgmt_uploads").delete().eq("id", upload.id);
        throw new Error(`거래 저장 실패: ${txError.message}`);
      }
    }

    // 3. 상태 업데이트
    await supabase
      .from("mgmt_uploads")
      .update({ status: "completed" })
      .eq("id", upload.id);

    return Response.json({
      success: true,
      uploadId: upload.id,
      result,
      excluded,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

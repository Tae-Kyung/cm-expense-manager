import { exportToExcel } from "@/lib/exporter";
import type { TransformResult } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") || "";

    let result: TransformResult;

    if (contentType.includes("application/json")) {
      // JSON body: 이미 변환된 결과를 받아서 Excel 생성
      const body = await request.json();
      result = body.result as TransformResult;
    } else {
      // FormData: 파일을 받아서 파싱 + 변환 + Excel 생성
      const { processFile } = await import("@/lib/process-file");
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return Response.json({ error: "파일이 없습니다." }, { status: 400 });
      }
      const buffer = await file.arrayBuffer();
      const processed = processFile(buffer);
      result = processed.result;
    }

    const excelBuffer = await exportToExcel(result);
    const filename = `경비정리_${result.sheetName.replace(/\s/g, "")}.xlsx`;
    const encodedFilename = encodeURIComponent(filename);

    const headers = new Headers({
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodedFilename}`,
      "X-Filename": encodedFilename,
    });

    return new Response(new Uint8Array(excelBuffer), { headers });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "다운로드 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

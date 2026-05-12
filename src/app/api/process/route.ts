import { processFile } from "@/lib/process-file";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    if (!file.name.endsWith(".xls") && !file.name.endsWith(".xlsx")) {
      return Response.json(
        { error: "xls 또는 xlsx 파일만 지원합니다." },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const { result, excluded } = processFile(buffer);

    return Response.json({ result, excluded });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "처리 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

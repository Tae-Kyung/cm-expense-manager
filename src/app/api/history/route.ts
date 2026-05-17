import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("mgmt_uploads")
      .select("*")
      .order("uploaded_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ uploads: data });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "조회 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = getSupabase();
    const { id } = await request.json();
    if (!id) {
      return Response.json({ error: "ID가 필요합니다." }, { status: 400 });
    }

    const { error } = await supabase
      .from("mgmt_uploads")
      .delete()
      .eq("id", id);

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({ success: true });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "삭제 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}

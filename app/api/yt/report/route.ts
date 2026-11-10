import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { cronOk } from "@/lib/yt";

export const dynamic = "force-dynamic";

// n8n avisa o resultado do upload: { id, youtube_video_id } ou { id, error }
export async function POST(req: NextRequest) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  const db = admin();
  if (b.youtube_video_id) {
    await db.from("yt_videos").update({ status: "scheduled", youtube_video_id: b.youtube_video_id, uploaded_at: new Date().toISOString(), error: null }).eq("id", b.id);
    return NextResponse.json({ ok: true });
  }
  if (!b.error) return NextResponse.json({ error: "faltou youtube_video_id ou error" }, { status: 400 }); // não marca como falha por engano
  await db.from("yt_videos").update({ status: "failed", error: String(b.error).slice(0, 500) }).eq("id", b.id);
  return NextResponse.json({ ok: true, failed: true });
}

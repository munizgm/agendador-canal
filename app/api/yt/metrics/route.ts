import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { cronOk } from "@/lib/yt";

export const dynamic = "force-dynamic";

// n8n envia { items: [...] } = resposta do YouTube videos.list (part=status,statistics)
export async function POST(req: NextRequest) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const db = admin();
  let n = 0;
  for (const it of (b.items || []) as any[]) {
    const { data: v } = await db.from("yt_videos").select("id,status,published_at").eq("youtube_video_id", it.id).maybeSingle();
    if (!v) continue;
    const s = it.statistics || {};
    const views = Number(s.viewCount || 0), likes = Number(s.likeCount || 0), comments = Number(s.commentCount || 0);
    const upd: any = { views, likes, comments, metrics_at: new Date().toISOString() };
    const priv = it.status?.privacyStatus, up = it.status?.uploadStatus;
    if (priv === "public" && v.status !== "published") { upd.status = "published"; upd.published_at = v.published_at || new Date().toISOString(); }
    if (up === "rejected" || up === "failed") { upd.status = "failed"; upd.error = "YouTube: " + (it.status?.rejectionReason || it.status?.failureReason || up); }
    await db.from("yt_videos").update(upd).eq("id", v.id);
    await db.from("yt_metrics").insert({ video_id: v.id, views, likes, comments });
    n++;
  }
  return NextResponse.json({ ok: true, atualizados: n });
}

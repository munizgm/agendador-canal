import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { cronOk } from "@/lib/yt";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

// Devolve lotes de até 50 IDs do YouTube para o n8n consultar (status + estatísticas).
async function run(req: NextRequest) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await admin().from("yt_videos").select("youtube_video_id").in("status", ["scheduled", "published"])
    .not("youtube_video_id", "is", null).order("created_at", { ascending: false }).limit(500);
  const ids = (data || []).map((r) => r.youtube_video_id as string);
  const batches: { ids: string }[] = [];
  for (let i = 0; i < ids.length; i += 50) batches.push({ ids: ids.slice(i, i + 50).join(",") });
  return NextResponse.json(batches.length ? batches : [{ ids: "" }]);
}

import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { cronOk } from "@/lib/yt";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

// n8n chama a cada 5 min. Devolve o próximo vídeo da fila para subir (ou {empty:true}).
// Sobe vídeos que vão sair nas próximas 36 h (assim ainda dá tempo de cancelar os mais distantes).
async function run(req: NextRequest) {
  if (!cronOk(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const now = Date.now();

  // travados em "uploading" há mais de 30 min => falha (NÃO repete sozinho, p/ não duplicar no YouTube)
  await db.from("yt_videos").update({ status: "failed", error: "Travou no envio (30 min). Confira no YouTube Studio se subiu antes de tentar de novo." })
    .eq("status", "uploading").lt("claimed_at", new Date(now - 30 * 60 * 1000).toISOString());

  const limit = new Date(now + 36 * 3600 * 1000).toISOString();
  const { data: cands } = await db.from("yt_videos").select("*").eq("status", "queued").lte("publish_at", limit).order("publish_at").limit(5);
  for (const v of cands || []) {
    // reserva de forma atômica (só um n8n pega)
    const { data: got } = await db.from("yt_videos").update({ status: "uploading", claimed_at: new Date().toISOString() })
      .eq("id", v.id).eq("status", "queued").select("id").maybeSingle();
    if (!got) continue;
    const { data: acc } = await db.from("yt_accounts").select("category_id").eq("id", v.account_id).maybeSingle();
    // o YouTube exige horário futuro; se já passou, agenda para daqui a 10 min
    const at = Math.max(new Date(v.publish_at).getTime(), now + 10 * 60 * 1000);
    return NextResponse.json({
      id: v.id, video_url: v.video_url,
      title: String(v.title).slice(0, 100), description: v.description || "", tags: v.tags || "",
      category_id: acc?.category_id || "22", publish_at: new Date(at).toISOString(),
    });
  }
  return NextResponse.json({ empty: true });
}

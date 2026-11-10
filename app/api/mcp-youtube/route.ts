import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { DEFAULT_SLOTS, nextSlots, parseWhen, brt } from "@/lib/yt";

// MCP do YouTube — separado do /api/mcp (Instagram). Mesma MCP_KEY.
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const text = (o: any) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
const err = (m: string) => ({ isError: true, content: [{ type: "text", text: m }] });
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);

const TOOLS: any[] = [
  { name: "listar_agenda_youtube", description: "Lista a fila de vídeos do YouTube (rascunho, na fila, enviando, agendado no YouTube, publicado, falha).",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["draft", "queued", "uploading", "scheduled", "published", "failed"] }, limit: { type: "number" } } } },
  { name: "criar_upload_youtube", description: "Gera URLs assinadas para subir MP4 ao Storage (limite de 50 MB por arquivo no plano grátis do Supabase). Faça PUT do arquivo em upload_url e use public_url em agendar_video_youtube.",
    inputSchema: { type: "object", properties: { arquivos: { type: "array", items: { type: "string" } } }, required: ["arquivos"] } },
  { name: "agendar_video_youtube", description: "Põe um vídeo na fila do YouTube. Sem scheduled_at, usa o próximo horário livre dos horários diários da conta. Recusa título repetido a menos que force=true.",
    inputSchema: { type: "object", properties: {
      video_url: { type: "string" }, title: { type: "string", description: "até 100 caracteres" },
      description: { type: "string" }, tags: { type: "string", description: "separadas por vírgula (até ~500 caracteres)" },
      scheduled_at: { type: "string", description: "ISO 8601; sem fuso = Brasília. Opcional." }, force: { type: "boolean" } },
      required: ["video_url", "title"] } },
  { name: "cancelar_video_youtube", description: "Remove da fila um vídeo que AINDA NÃO foi enviado ao YouTube (rascunho/na fila/falha). Se já subiu, apague no YouTube Studio.",
    inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "ver_metricas_youtube", description: "Views, curtidas e comentários dos vídeos publicados pelo app.",
    inputSchema: { type: "object", properties: { limit: { type: "number" } } } },
];

async function call(name: string, a: any) {
  const db = admin();
  switch (name) {
    case "listar_agenda_youtube": {
      let q = db.from("yt_videos").select("id,title,publish_at,status,youtube_video_id,error,views").order("publish_at", { ascending: false }).limit(a.limit || 50);
      if (a.status) q = q.eq("status", a.status);
      const { data, error } = await q; if (error) throw error;
      return text((data || []).map((v) => ({ ...v, quando: brt(v.publish_at), link: v.youtube_video_id ? `https://youtu.be/${v.youtube_video_id}` : null })));
    }
    case "criar_upload_youtube": {
      const out = [];
      for (const f of a.arquivos as string[]) {
        const path = `mcp-yt/${crypto.randomUUID()}.mp4`;
        const { data, error } = await db.storage.from("media").createSignedUploadUrl(path);
        if (error) throw error;
        out.push({ arquivo: f, upload_url: data.signedUrl, token: data.token, public_url: db.storage.from("media").getPublicUrl(path).data.publicUrl });
      }
      return text(out);
    }
    case "agendar_video_youtube": {
      const { data: accs } = await db.from("yt_accounts").select("id,user_id,slots").limit(1);
      const acc = accs?.[0]; if (!acc) throw new Error("Conta do YouTube não criada. Abra YouTube > Conta no app e salve.");
      if (String(a.title).length > 100) throw new Error("Título com mais de 100 caracteres.");
      if (!a.force) {
        const { data: ex } = await db.from("yt_videos").select("title").neq("status", "failed");
        if ((ex || []).some((v) => norm(v.title) === norm(a.title))) throw new Error("Já existe um vídeo com esse título. Use force=true para repetir.");
      }
      let when: Date;
      if (a.scheduled_at) when = parseWhen(a.scheduled_at);
      else {
        const { data: t } = await db.from("yt_videos").select("publish_at").neq("status", "failed");
        const taken = new Set((t || []).map((r) => new Date(r.publish_at).getTime()));
        when = nextSlots((acc.slots as string[]) || DEFAULT_SLOTS, taken, 1)[0];
      }
      const { data, error } = await db.from("yt_videos").insert({
        user_id: acc.user_id, account_id: acc.id, title: a.title, description: a.description || "", tags: a.tags || "",
        video_url: a.video_url, publish_at: when.toISOString(), status: "queued" }).select("id,publish_at").single();
      if (error) throw error;
      return text({ id: data.id, vai_sair: brt(data.publish_at) + " (Brasília)" });
    }
    case "cancelar_video_youtube": {
      const { data: v } = await db.from("yt_videos").select("status").eq("id", a.id).maybeSingle();
      if (!v) throw new Error("Não encontrado.");
      if (!["draft", "queued", "failed"].includes(v.status)) throw new Error(`Status "${v.status}": já foi enviado ao YouTube. Apague no YouTube Studio.`);
      await db.from("yt_videos").delete().eq("id", a.id);
      return text("Removido da fila.");
    }
    case "ver_metricas_youtube": {
      const { data, error } = await db.from("yt_videos").select("title,status,published_at,views,likes,comments,youtube_video_id,metrics_at")
        .in("status", ["scheduled", "published"]).order("publish_at", { ascending: false }).limit(a.limit || 50);
      if (error) throw error;
      return text(data);
    }
  }
  return err("Ferramenta desconhecida: " + name);
}

async function handle(m: any) {
  const id = m.id;
  const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
  switch (m.method) {
    case "initialize":
      return ok({ protocolVersion: m.params?.protocolVersion || "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "agenda-youtube", version: "1.0.0" } });
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call":
      try { return ok(await call(m.params.name, m.params.arguments || {})); }
      catch (e: any) { return ok(err(e.message || String(e))); }
    case "ping": return ok({});
    default:
      if (id === undefined) return null;
      return { jsonrpc: "2.0", id, error: { code: -32601, message: "Method not found" } };
  }
}

function authed(req: NextRequest) {
  const key = process.env.MCP_KEY;
  if (!key) return false;
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return req.nextUrl.searchParams.get("key") === key || bearer === key;
}

export async function POST(req: NextRequest) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  if (Array.isArray(body)) {
    const res = (await Promise.all(body.map(handle))).filter(Boolean);
    return res.length ? NextResponse.json(res) : new NextResponse(null, { status: 202 });
  }
  const r = await handle(body);
  return r ? NextResponse.json(r) : new NextResponse(null, { status: 202 });
}
export async function GET() { return new NextResponse("MCP YouTube endpoint. Use POST.", { status: 405 }); }

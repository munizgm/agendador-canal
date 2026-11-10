import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { syncMedia } from "@/lib/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

// ---------- helpers ----------
const norm = (s: string) => (s || "").toLowerCase().replace(/\s+/g, " ").trim().slice(0, 60);
const text = (o: any) => ({ content: [{ type: "text", text: typeof o === "string" ? o : JSON.stringify(o, null, 2) }] });
const err = (m: string) => ({ isError: true, content: [{ type: "text", text: m }] });

function parseWhen(s: string) {
  // sem fuso => horário de Brasília (-03:00)
  const iso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : s.replace(" ", "T") + "-03:00";
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error("scheduled_at inválido: " + s);
  return d;
}

async function account(db: ReturnType<typeof admin>, name?: string) {
  const { data } = await db.from("accounts").select("id,name,user_id");
  const a = name ? data?.find((x) => x.name === name) : data?.[0];
  if (!a) throw new Error("Conta não encontrada. Conecte em Conta no app.");
  return a;
}

// ---------- tools ----------
const TOOLS: any[] = [
  { name: "listar_agenda", description: "Lista posts da fila do app (agendados, processando, publicados pelo app, falhas, rascunhos).",
    inputSchema: { type: "object", properties: { status: { type: "string", enum: ["scheduled", "processing", "published", "failed", "draft"] }, limit: { type: "number" } } } },
  { name: "listar_publicados", description: "Lista TUDO que já está publicado no Instagram (feed, carrosséis, Reels), lido da própria API. Use antes de agendar para não repetir conteúdo.",
    inputSchema: { type: "object", properties: { limit: { type: "number" }, sincronizar: { type: "boolean", description: "Atualizar do Instagram antes de listar" } } } },
  { name: "criar_upload", description: "Gera URLs assinadas para subir arquivos (imagem JPEG ou vídeo MP4) ao Storage. Faça PUT do arquivo na upload_url e use public_url em agendar_post. Imagens precisam ser JPEG.",
    inputSchema: { type: "object", properties: { arquivos: { type: "array", items: { type: "string" }, description: "nomes, ex: ['slide1.jpg','capa.jpg','reel.mp4']" } }, required: ["arquivos"] } },
  { name: "agendar_post", description: "Agenda um post. type: feed (1 imagem), carousel (2-10 imagens/vídeos), reel (1 vídeo + capa opcional), story (1 imagem/vídeo). Recusa conteúdo cuja legenda repete algo já postado/agendado, a menos que force=true.",
    inputSchema: { type: "object", properties: {
      type: { type: "string", enum: ["feed", "carousel", "reel", "story"] },
      media_urls: { type: "array", items: { type: "string" } },
      caption: { type: "string" }, title: { type: "string" },
      scheduled_at: { type: "string", description: "ISO 8601. Sem fuso = horário de Brasília. Ex: 2026-10-31T09:00" },
      cover_url: { type: "string" }, share_to_feed: { type: "boolean" },
      conta: { type: "string" }, force: { type: "boolean" } }, required: ["type", "media_urls", "scheduled_at"] } },
  { name: "cancelar_post", description: "Apaga da agenda um post ainda não publicado.", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "publicar_agora", description: "Marca um post agendado/rascunho/falho para sair na próxima rodada do n8n (até 5 min).", inputSchema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] } },
  { name: "sincronizar_instagram", description: "Importa do Instagram o que já foi publicado.", inputSchema: { type: "object", properties: {} } },
  { name: "ver_metricas", description: "Seguidores por dia e desempenho dos posts (views, alcance, curtidas, salvos, compartilhamentos).",
    inputSchema: { type: "object", properties: { dias: { type: "number" } } } },
];

async function call(name: string, a: any) {
  const db = admin();
  switch (name) {
    case "listar_agenda": {
      let q = db.from("posts").select("id,type,title,caption,scheduled_at,status,permalink,error").order("scheduled_at", { ascending: false }).limit(a.limit || 50);
      if (a.status) q = q.eq("status", a.status);
      const { data, error } = await q; if (error) throw error;
      return text((data || []).map((p) => ({ ...p, caption: (p.caption || "").slice(0, 80) })));
    }
    case "listar_publicados": {
      if (a.sincronizar) await syncMedia();
      const { data, error } = await db.from("ig_media").select("*").order("posted_at", { ascending: false }).limit(a.limit || 100);
      if (error) throw error;
      return text((data || []).map((r) => ({ data: r.posted_at, tipo: r.media_type === "CAROUSEL_ALBUM" ? "carrossel" : r.product_type === "REELS" ? "reel" : "estatico", legenda: (r.caption || "").slice(0, 100), link: r.permalink })));
    }
    case "sincronizar_instagram": return text(await syncMedia());
    case "criar_upload": {
      const out = [];
      for (const f of a.arquivos as string[]) {
        const ext = (f.split(".").pop() || "jpg").toLowerCase();
        const path = `mcp/${crypto.randomUUID()}.${ext}`;
        const { data, error } = await db.storage.from("media").createSignedUploadUrl(path);
        if (error) throw error;
        out.push({ arquivo: f, upload_url: data.signedUrl, token: data.token, public_url: db.storage.from("media").getPublicUrl(path).data.publicUrl });
      }
      return text(out);
    }
    case "agendar_post": {
      const acc = await account(db, a.conta);
      const when = parseWhen(a.scheduled_at);
      const urls: string[] = a.media_urls || [];
      if (a.type === "carousel" && (urls.length < 2 || urls.length > 10)) return err("Carrossel precisa de 2 a 10 mídias.");
      if (a.type !== "carousel" && urls.length !== 1) return err("Este tipo aceita exatamente 1 mídia.");
      if (!a.force && a.caption) {
        const key = norm(a.caption);
        const [{ data: ig }, { data: ps }] = await Promise.all([
          db.from("ig_media").select("caption,permalink"), db.from("posts").select("caption,status").neq("status", "failed")]);
        const dup = ig?.find((r) => norm(r.caption || "") === key) || ps?.find((r) => norm(r.caption || "") === key);
        if (dup) return err("Recusado: essa legenda já foi postada ou está agendada (" + ((dup as any).permalink || (dup as any).status) + "). Use force=true se for intencional.");
      }
      const { data: post, error } = await db.from("posts").insert({
        user_id: acc.user_id, account_id: acc.id, type: a.type, title: a.title || "", caption: a.caption || "",
        cover_url: a.cover_url || null, share_to_feed: a.share_to_feed ?? true, scheduled_at: when.toISOString(), status: "scheduled",
      }).select("id").single();
      if (error) throw error;
      const kind = (u: string) => (/\.(mp4|mov)(\?|$)/i.test(u) ? "video" : "image");
      const { error: e2 } = await db.from("post_media").insert(urls.map((u, i) => ({ post_id: post!.id, position: i, url: u, kind: kind(u) })));
      if (e2) throw e2;
      return text({ ok: true, id: post!.id, publica_em: when.toISOString() });
    }
    case "cancelar_post": {
      const { data } = await db.from("posts").select("status").eq("id", a.id).single();
      if (!data) return err("Post não encontrado.");
      if (data.status === "published") return err("Já publicado; não dá para cancelar pelo app.");
      await db.from("posts").delete().eq("id", a.id);
      return text({ ok: true });
    }
    case "publicar_agora": {
      await db.from("posts").update({ status: "scheduled", scheduled_at: new Date().toISOString(), attempts: 0, error: null, container_id: null }).eq("id", a.id);
      return text({ ok: true, nota: "sai na próxima rodada do n8n (até 5 min)" });
    }
    case "ver_metricas": {
      const since = new Date(Date.now() - (a.dias || 14) * 86400e3).toISOString().slice(0, 10);
      const { data: snaps } = await db.from("account_snapshots").select("day,followers,media_count,reach,views,profile_views,website_clicks").gte("day", since).order("day");
      const { data: posts } = await db.from("posts").select("title,caption,type,permalink,published_at,post_insights(views,reach,likes,comments,saves,shares,fetched_at)").eq("status", "published").order("published_at", { ascending: false }).limit(30);
      return text({ conta_por_dia: snaps, posts: (posts || []).map((p: any) => ({ titulo: p.title || (p.caption || "").slice(0, 50), tipo: p.type, link: p.permalink, ...((p.post_insights || []).sort((x: any, y: any) => y.fetched_at.localeCompare(x.fetched_at))[0] || {}) })) });
    }
  }
  return err("Ferramenta desconhecida: " + name);
}

// ---------- JSON-RPC (MCP Streamable HTTP, sem estado) ----------
async function handle(m: any) {
  const id = m.id;
  const ok = (result: any) => ({ jsonrpc: "2.0", id, result });
  switch (m.method) {
    case "initialize":
      return ok({ protocolVersion: m.params?.protocolVersion || "2025-03-26", capabilities: { tools: {} }, serverInfo: { name: "agenda-posts", version: "1.0.0" } });
    case "tools/list": return ok({ tools: TOOLS });
    case "tools/call":
      try { return ok(await call(m.params.name, m.params.arguments || {})); }
      catch (e: any) { return ok(err(e.message || String(e))); }
    case "ping": return ok({});
    default:
      if (id === undefined) return null; // notificação
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
export async function GET() { return new NextResponse("MCP endpoint. Use POST.", { status: 405 }); }

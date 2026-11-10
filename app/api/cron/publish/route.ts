import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { createContainer, publish, statusOf } from "@/lib/instagram";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

async function run(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = admin();
  const log = async (post_id: string, step: string, ok: boolean, detail = "") =>
    db.from("publish_logs").insert({ post_id, step, ok, detail: detail.slice(0, 500) });
  const out: any[] = [];

  // 1) Posts já com container criado: verificar se terminou e publicar
  const { data: processing } = await db.from("posts").select("*, accounts(*)").eq("status", "processing");
  for (const p of processing || []) {
    try {
      const st = await statusOf(p.container_id, p.accounts.access_token);
      if (st.code === "FINISHED") {
        const r = await publish(p.accounts.ig_user_id, p.accounts.access_token, p.container_id);
        await db.from("posts").update({ status: "published", ig_media_id: r.mediaId, permalink: r.permalink, published_at: new Date().toISOString(), error: null }).eq("id", p.id);
        await log(p.id, "publish", true, r.permalink || "");
        out.push({ id: p.id, published: true });
      } else if (st.code === "ERROR" || st.code === "EXPIRED") {
        await db.from("posts").update({ status: "failed", error: `Container ${st.code}: ${st.detail || ""}` }).eq("id", p.id);
        await log(p.id, "status", false, `${st.code} ${st.detail || ""}`);
        out.push({ id: p.id, failed: st.code });
      } else out.push({ id: p.id, waiting: st.code });
    } catch (e: any) {
      const attempts = (p.attempts || 0) + 1;
      await db.from("posts").update({ attempts, status: attempts >= 5 ? "failed" : "processing", error: e.message }).eq("id", p.id);
      await log(p.id, "status", false, e.message);
    }
  }

  // 2) Posts agendados que já deram a hora: criar container
  const { data: due } = await db.from("posts").select("*, accounts(*), post_media(*)")
    .eq("status", "scheduled").lte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5);
  for (const p of due || []) {
    try {
      const media = (p.post_media || []).sort((a: any, b: any) => a.position - b.position);
      if (!media.length) throw new Error("Post sem mídia");
      const c = await createContainer(p.accounts.ig_user_id, p.accounts.access_token, p, media);
      await db.from("posts").update({ status: "processing", container_id: c.id, child_ids: c.children, error: null }).eq("id", p.id);
      await log(p.id, "container", true, c.id);
      // imagens costumam ficar prontas em segundos: tenta publicar já
      await sleep(4000);
      const st = await statusOf(c.id, p.accounts.access_token).catch(() => ({ code: "" }));
      if (st.code === "FINISHED") {
        const r = await publish(p.accounts.ig_user_id, p.accounts.access_token, c.id);
        await db.from("posts").update({ status: "published", ig_media_id: r.mediaId, permalink: r.permalink, published_at: new Date().toISOString() }).eq("id", p.id);
        await log(p.id, "publish", true, r.permalink || "");
        out.push({ id: p.id, published: true });
      } else out.push({ id: p.id, container: c.id });
    } catch (e: any) {
      const attempts = (p.attempts || 0) + 1;
      await db.from("posts").update({ attempts, status: attempts >= 3 ? "failed" : "scheduled", error: e.message }).eq("id", p.id);
      await log(p.id, "container", false, e.message);
      out.push({ id: p.id, error: e.message });
    }
  }
  return NextResponse.json({ ok: true, results: out });
}

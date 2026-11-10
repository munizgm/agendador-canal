import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";
import { ig } from "@/lib/instagram";
import { syncMedia } from "@/lib/sync";

export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

const sum = (j: any) => (j?.data || []).reduce((a: any, m: any) => {
  a[m.name] = m.total_value?.value ?? m.values?.[0]?.value ?? 0; return a;
}, {} as Record<string, number>);

async function run(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const { data: accounts } = await db.from("accounts").select("*");
  const out: any[] = [];

  for (const a of accounts || []) {
    const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10); // dia em BRT
    try {
      const prof = await ig(a.ig_user_id, a.access_token, "GET", { fields: "followers_count,media_count" });
      let ins: Record<string, number> = {};
      try {
        const j = await ig(`${a.ig_user_id}/insights`, a.access_token, "GET", {
          metric: "reach,views,profile_views,website_clicks", period: "day", metric_type: "total_value",
        });
        ins = sum(j);
      } catch { /* conta pequena / métrica indisponível */ }
      await db.from("account_snapshots").upsert({
        account_id: a.id, day, followers: prof.followers_count, media_count: prof.media_count,
        reach: ins.reach ?? null, views: ins.views ?? null, profile_views: ins.profile_views ?? null, website_clicks: ins.website_clicks ?? null,
      }, { onConflict: "account_id,day" });
    } catch (e: any) { out.push({ account: a.name, error: e.message }); }

    // insights dos posts publicados nos últimos 30 dias (stories só valem por 24h)
    const since = new Date(Date.now() - 30 * 86400e3).toISOString();
    const { data: posts } = await db.from("posts").select("id,type,ig_media_id")
      .eq("account_id", a.id).eq("status", "published").gte("published_at", since).not("ig_media_id", "is", null);
    for (const p of posts || []) {
      const sets = p.type === "story"
        ? ["reach,views,shares,replies", "reach,views"]
        : ["views,reach,likes,comments,saved,shares", "reach,likes,comments", "reach"];
      for (const metric of sets) {
        try {
          const j = await ig(`${p.ig_media_id}/insights`, a.access_token, "GET", { metric });
          const m = sum(j);
          await db.from("post_insights").insert({
            post_id: p.id, views: m.views ?? null, reach: m.reach ?? null, likes: m.likes ?? null,
            comments: m.comments ?? null, saves: m.saved ?? null, shares: m.shares ?? null,
          });
          break;
        } catch { /* tenta o próximo conjunto */ }
      }
    }
    out.push({ account: a.name, posts: posts?.length || 0 });
  }
  const synced = await syncMedia().catch((e) => [{ error: e.message }]);
  return NextResponse.json({ ok: true, results: out, synced });
}

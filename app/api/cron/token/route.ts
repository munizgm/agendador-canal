import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/admin";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) { return run(req); }
export async function POST(req: NextRequest) { return run(req); }

// Renova tokens do Instagram (valem 60 dias; renovar com mais de 24h de vida e antes de expirar)
async function run(req: NextRequest) {
  if (req.headers.get("x-cron-secret") !== process.env.CRON_SECRET)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = admin();
  const { data: accs } = await db.from("accounts").select("id,name,access_token");
  const out: any[] = [];
  for (const a of accs || []) {
    if (!a.access_token.startsWith("IG")) { out.push({ account: a.name, skipped: "token de Página não expira" }); continue; }
    try {
      const r = await fetch(`https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${a.access_token}`);
      const j: any = await r.json();
      if (!r.ok || j.error) throw new Error(j.error?.message || `HTTP ${r.status}`);
      await db.from("accounts").update({ access_token: j.access_token }).eq("id", a.id);
      out.push({ account: a.name, renewed: true, expires_in: j.expires_in });
    } catch (e: any) { out.push({ account: a.name, error: e.message }); }
  }
  return NextResponse.json({ ok: true, results: out });
}

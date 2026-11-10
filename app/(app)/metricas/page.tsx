"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Metricas() {
  const [snaps, setSnaps] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("account_snapshots").select("*").order("day", { ascending: false }).limit(30).then(({ data }) => setSnaps(data || []));
    supabase.from("posts").select("id,title,caption,type,permalink,published_at, post_insights(views,reach,likes,comments,saves,shares,fetched_at)")
      .eq("status", "published").order("published_at", { ascending: false }).limit(50)
      .then(({ data }) => setPosts((data || []).map((p: any) => ({ ...p, ins: (p.post_insights || []).sort((a: any, b: any) => b.fetched_at.localeCompare(a.fetched_at))[0] || {} }))));
  }, []);
  const last = snaps[0], prev = snaps[snaps.length - 1];
  const delta = last && prev && last !== prev ? (last.followers ?? 0) - (prev.followers ?? 0) : 0;
  const rank = [...posts].sort((a, b) => (b.ins.views ?? b.ins.reach ?? 0) - (a.ins.views ?? a.ins.reach ?? 0));
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[["Seguidores", last?.followers], ["Δ no período", delta ? (delta > 0 ? "+" : "") + delta : "—"], ["Alcance (dia)", last?.reach], ["Visitas ao perfil", last?.profile_views]].map(([l, v]) => (
          <div key={l as string} className="card"><div className="text-xs text-cream/50">{l}</div><div className="text-2xl font-serif text-gold">{v ?? "—"}</div></div>
        ))}
      </div>
      <section className="card overflow-x-auto">
        <h2 className="font-semibold mb-3">Posts por desempenho</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-cream/50"><tr><th>Post</th><th>Views</th><th>Alcance</th><th>Curtidas</th><th>Coment.</th><th>Salvos</th><th>Compart.</th></tr></thead>
          <tbody>
            {rank.map((p) => (
              <tr key={p.id} className="border-t border-line">
                <td className="py-2 pr-2 max-w-[260px] truncate">{p.permalink ? <a className="hover:text-gold" href={p.permalink} target="_blank">{p.title || p.caption.slice(0, 40)}</a> : p.title}</td>
                {["views", "reach", "likes", "comments", "saves", "shares"].map((k) => <td key={k}>{p.ins[k] ?? "—"}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
        {rank.length === 0 && <p className="text-sm text-cream/60">Ainda sem dados. O n8n busca as métricas 1x por dia.</p>}
      </section>
    </div>
  );
}

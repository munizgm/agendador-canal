"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brt } from "@/lib/yt";

export default function YtMetricas() {
  const [rows, setRows] = useState<any[]>([]);
  const [sort, setSort] = useState<"views" | "likes" | "comments" | "published_at">("views");
  useEffect(() => { supabase.from("yt_videos").select("*").in("status", ["scheduled", "published"]).not("youtube_video_id", "is", null).limit(1000).then(({ data }) => setRows(data || [])); }, []);
  const sorted = [...rows].sort((a, b) => sort === "published_at" ? +new Date(b.publish_at) - +new Date(a.publish_at) : (b[sort] || 0) - (a[sort] || 0));
  const sum = (k: string) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl text-gold">Métricas do YouTube</h1>
      <div className="grid grid-cols-3 gap-3">
        {[["Views", sum("views")], ["Curtidas", sum("likes")], ["Comentários", sum("comments")]].map(([l, v]) => (
          <div key={l as string} className="card"><div className="text-xs text-cream/50">{l}</div><div className="text-2xl text-gold">{(v as number).toLocaleString("pt-BR")}</div></div>
        ))}
      </div>
      <div className="flex gap-2 text-xs items-center"><span className="text-cream/50">ordenar:</span>
        {([["views", "views"], ["likes", "curtidas"], ["comments", "comentários"], ["published_at", "data"]] as const).map(([k, l]) => (
          <button key={k} className={`btn2 ${sort === k ? "border-gold text-gold" : ""}`} onClick={() => setSort(k)}>{l}</button>))}
      </div>
      {sorted.map((r) => (
        <div key={r.id} className="card text-sm flex gap-3 items-center">
          <span className="text-cream/50 w-24 shrink-0">{brt(r.publish_at)}</span>
          <span className="truncate flex-1">{r.title}</span>
          <span className="w-20 text-right">{r.views}</span><span className="w-16 text-right text-cream/60">{r.likes} ♥</span><span className="w-16 text-right text-cream/60">{r.comments} 💬</span>
        </div>
      ))}
      {rows.length === 0 && <p className="text-sm text-cream/60">Sem dados ainda. O workflow “YouTube – métricas” do n8n preenche isso.</p>}
    </div>
  );
}

"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { brt } from "@/lib/yt";

export default function YtPostados() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { supabase.from("yt_videos").select("*").eq("status", "published").order("published_at", { ascending: false }).limit(500).then(({ data }) => setRows(data || [])); }, []);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl text-gold">Já postado no YouTube</h1>
        <span className="text-xs text-cream/50">{rows.length} vídeos</span>
      </div>
      {rows.length === 0 && <p className="text-sm text-cream/60">Nada publicado ainda. O status muda sozinho depois da hora marcada (o n8n confere de hora em hora).</p>}
      {rows.map((r) => (
        <div key={r.id} className="card text-sm flex gap-3 items-center">
          <span className="text-cream/50 w-24 shrink-0">{brt(r.published_at || r.publish_at)}</span>
          <a className="truncate flex-1 hover:text-gold" target="_blank" href={`https://youtu.be/${r.youtube_video_id}`}>{r.title}</a>
          <span className="text-xs text-cream/50 shrink-0">{r.views} views</span>
        </div>
      ))}
    </div>
  );
}

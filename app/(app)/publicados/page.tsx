"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const T: Record<string, string> = { VIDEO: "Reel", REELS: "Reel", FEED: "Feed", CAROUSEL_ALBUM: "Carrossel", IMAGE: "Estático" };

export default function Publicados() {
  const [rows, setRows] = useState<any[]>([]);
  const [copied, setCopied] = useState(false);
  useEffect(() => { supabase.from("ig_media").select("*").order("posted_at", { ascending: false }).limit(300).then(({ data }) => setRows(data || [])); }, []);
  const lines = rows.map((r) => `${new Date(r.posted_at).toLocaleDateString("pt-BR")} | ${r.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : r.product_type === "REELS" ? "Reel" : "Estático"} | ${(r.caption || "").replace(/\s+/g, " ").slice(0, 90)} | ${r.permalink}`).join("\n");
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <h1 className="font-serif text-2xl text-gold">Já postado no Instagram</h1>
        <span className="text-xs text-cream/50">{rows.length} itens</span>
        <button className="btn2 ml-auto" onClick={() => navigator.clipboard.writeText(lines).then(() => setCopied(true))}>{copied ? "copiado!" : "copiar lista"}</button>
      </div>
      {rows.length === 0 && <p className="text-sm text-cream/60">Vazio. Rode o workflow de métricas no n8n uma vez (Execute workflow) para importar.</p>}
      {rows.map((r) => (
        <div key={r.ig_media_id} className="card text-sm flex gap-3">
          <span className="text-cream/50 w-20 shrink-0">{new Date(r.posted_at).toLocaleDateString("pt-BR")}</span>
          <span className="text-gold w-20 shrink-0">{r.media_type === "CAROUSEL_ALBUM" ? "Carrossel" : r.product_type === "REELS" ? "Reel" : "Estático"}</span>
          <a className="truncate hover:text-gold" href={r.permalink} target="_blank">{(r.caption || "(sem legenda)").slice(0, 110)}</a>
        </div>
      ))}
    </div>
  );
}

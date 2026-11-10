"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { brt, brtDay, toLocalInput, parseWhen } from "@/lib/yt";

const ST: Record<string, [string, string]> = {
  draft: ["rascunho", "text-cream/50"], queued: ["na fila", "text-gold"], uploading: ["enviando…", "text-blue-300"],
  scheduled: ["agendado no YouTube", "text-green-400"], failed: ["falhou", "text-red-400"],
};

export default function YtAgenda() {
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState("all");
  const load = useCallback(() => {
    supabase.from("yt_videos").select("*").in("status", ["draft", "queued", "uploading", "scheduled", "failed"]).order("publish_at").limit(500).then(({ data }) => setRows(data || []));
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);

  const del = async (id: string) => { if (confirm("Tirar da fila?")) { await supabase.from("yt_videos").delete().eq("id", id); load(); } };
  const retry = async (v: any) => {
    if (!confirm("Tentar de novo? Antes, confira no YouTube Studio se o vídeo não subiu mesmo com o erro (evita duplicar).")) return;
    await supabase.from("yt_videos").update({ status: "queued", error: null }).eq("id", v.id); load();
  };
  const jaSubiu = async (v: any) => {
    const t = prompt("Cole o link do vídeo no YouTube (ou o ID de 11 caracteres):") || "";
    const id = t.match(/(?:v=|youtu\.be\/|\/video\/|shorts\/)([\w-]{11})/)?.[1] || (/^[\w-]{11}$/.test(t.trim()) ? t.trim() : "");
    if (!id) return alert("Não achei o ID do vídeo.");
    await supabase.from("yt_videos").update({ status: "scheduled", youtube_video_id: id, error: null, uploaded_at: new Date().toISOString() }).eq("id", v.id); load();
  };
  const move = async (id: string, val: string) => {
    if (!val) return; await supabase.from("yt_videos").update({ publish_at: parseWhen(val).toISOString() }).eq("id", id); load();
  };

  const shown = rows.filter((r) => f === "all" || r.status === f);
  const days: Record<string, any[]> = {};
  shown.forEach((r) => (days[brtDay(r.publish_at)] ||= []).push(r));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="font-serif text-2xl text-gold mr-3">Agenda do YouTube</h1>
        {["all", "queued", "scheduled", "failed"].map((k) => (
          <button key={k} className={`btn2 ${f === k ? "border-gold text-gold" : ""}`} onClick={() => setF(k)}>{k === "all" ? "todos" : ST[k][0]}</button>
        ))}
        <span className="text-xs text-cream/50 ml-auto">{shown.length} vídeos</span>
      </div>
      {shown.length === 0 && <p className="text-sm text-cream/60">Nada na fila. Use “Novo vídeo”.</p>}
      {Object.entries(days).map(([d, list]) => (
        <section key={d} className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-cream/50 mt-2">{d} · {list.length}</h2>
          {list.map((v) => (
            <div key={v.id} className="card text-sm space-y-1">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-cream/70 w-12 shrink-0">{brt(v.publish_at).slice(-5)}</span>
                <span className={`${ST[v.status][1]} w-36 shrink-0`}>{ST[v.status][0]}</span>
                <span className="truncate flex-1 min-w-[12rem]">{v.title}</span>
                {v.youtube_video_id && <a className="text-gold text-xs" target="_blank" href={`https://studio.youtube.com/video/${v.youtube_video_id}/edit`}>Studio ↗</a>}
                {v.status === "queued" && <input type="datetime-local" className="inp !w-auto !py-1 text-xs" defaultValue={toLocalInput(new Date(v.publish_at))} onBlur={(e) => e.target.value !== toLocalInput(new Date(v.publish_at)) && move(v.id, e.target.value)} />}
                {v.status === "failed" && <button className="btn2" onClick={() => jaSubiu(v)}>já subiu no YouTube</button>}
                {v.status === "failed" && <button className="btn2" onClick={() => retry(v)}>tentar de novo</button>}
                {["draft", "queued", "failed"].includes(v.status) && <button className="btn2" onClick={() => del(v.id)}>apagar</button>}
              </div>
              {v.error && <p className="text-xs text-red-400">{v.error}</p>}
              {v.status === "scheduled" && <p className="text-xs text-cream/40">Já está no YouTube, privado até a hora. Para cancelar, use o YouTube Studio.</p>}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

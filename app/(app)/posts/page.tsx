"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const LBL: Record<string, string> = { feed: "Estático", carousel: "Carrossel", reel: "Reel", story: "Story" };
const ST: Record<string, string> = { draft: "rascunho", scheduled: "agendado", processing: "processando", published: "publicado", failed: "falhou" };
const COL: Record<string, string> = { draft: "text-cream/50", scheduled: "text-gold", processing: "text-sky-300", published: "text-emerald-400", failed: "text-red-400" };

export default function Posts() {
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState("todos");
  const load = () => supabase.from("posts").select("*, post_media(url,kind,position)").order("scheduled_at", { ascending: false }).limit(200).then(({ data }) => setRows(data || []));
  useEffect(() => { load(); }, []);

  async function del(id: string) { if (confirm("Apagar este post da agenda?")) { await supabase.from("posts").delete().eq("id", id); load(); } }
  async function now(id: string) { await supabase.from("posts").update({ status: "scheduled", scheduled_at: new Date().toISOString(), attempts: 0, error: null }).eq("id", id); load(); }
  async function retry(id: string) { await supabase.from("posts").update({ status: "scheduled", attempts: 0, error: null, container_id: null }).eq("id", id); load(); }

  const list = rows.filter((r) => filter === "todos" || r.status === filter);
  const days: Record<string, any[]> = {};
  list.forEach((r) => { const d = new Date(r.scheduled_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }); (days[d] ||= []).push(r); });

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {["todos", "scheduled", "published", "failed", "draft"].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`btn2 ${filter === s ? "!border-gold text-gold" : ""}`}>{s === "todos" ? "Todos" : ST[s]}</button>
        ))}
      </div>
      {Object.keys(days).length === 0 && <p className="text-sm text-cream/60">Nada por aqui.</p>}
      {Object.entries(days).map(([d, items]) => (
        <section key={d}>
          <h3 className="text-xs uppercase tracking-wider text-cream/50 mb-2">{d}</h3>
          <div className="space-y-2">
            {items.map((r) => {
              const m = (r.post_media || []).sort((a: any, b: any) => a.position - b.position);
              return (
                <div key={r.id} className="card flex gap-3 items-start">
                  {m[0]?.kind === "image" ? <img src={m[0].url} className="w-14 h-14 object-cover rounded" alt="" /> : <div className="w-14 h-14 rounded bg-line grid place-items-center text-xs">▶</div>}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{r.title || r.caption.slice(0, 50) || "(sem título)"}</div>
                    <div className="text-xs text-cream/60">
                      {LBL[r.type]}{r.type === "carousel" ? ` (${m.length})` : ""} · {new Date(r.scheduled_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                      <span className={COL[r.status]}>{ST[r.status]}</span>
                    </div>
                    {r.error && <div className="text-xs text-red-400 mt-1 break-words">{r.error}</div>}
                  </div>
                  <div className="flex gap-1 flex-wrap justify-end">
                    {r.permalink && <a className="btn2" href={r.permalink} target="_blank">abrir</a>}
                    {(r.status === "scheduled" || r.status === "draft") && <button className="btn2" onClick={() => now(r.id)}>publicar já</button>}
                    {r.status === "failed" && <button className="btn2" onClick={() => retry(r.id)}>tentar de novo</button>}
                    {r.status !== "published" && <button className="btn2" onClick={() => del(r.id)}>apagar</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

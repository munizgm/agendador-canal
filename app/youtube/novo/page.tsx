"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadMedia } from "@/components/Uploader";
import { getYtAccount } from "@/lib/ytclient";
import { nextSlots, parseNotes, parseWhen, toLocalInput } from "@/lib/yt";

type Row = { file: File; title: string; description: string; tags: string; when: string; state: string };
const MAXMB = 50;
const base = (n: string) => n.replace(/\.[^.]+$/, "").replace(/^\d+[a-z]?_/i, "").replace(/_/g, " ");

export default function YtNovo() {
  const [acc, setAcc] = useState<any>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [notes, setNotes] = useState<Record<string, any>>({});
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    getYtAccount().then(setAcc);
    supabase.from("yt_videos").select("publish_at").neq("status", "failed").then(({ data }) => setTaken(new Set((data || []).map((r) => new Date(r.publish_at).getTime()))));
  }, []);

  const build = (files: File[], nt: Record<string, any>) => {
    const t = new Set(taken);
    const slots = nextSlots(acc?.slots || [], t, files.length);
    setRows(files.map((file, i) => {
      const n = nt[file.name];
      return { file, title: n?.title || base(file.name), description: n?.description || "", tags: n?.tags || "", when: slots[i] ? toLocalInput(slots[i]) : "", state: "" };
    }));
  };
  const onFiles = (fl: FileList | null) => {
    const files = Array.from(fl || []).sort((a, b) => a.name.localeCompare(b.name));
    build(files, notes);
  };
  const onNotes = async (fl: FileList | null) => {
    const f = fl?.[0]; if (!f) return;
    const nt = parseNotes(await f.text()); setNotes(nt);
    if (rows.length) build(rows.map((r) => r.file), nt);
    setMsg(`Arquivo de títulos lido: ${Object.keys(nt).length} vídeos.`);
  };
  const set = (i: number, k: keyof Row, v: string) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const send = async (asDraft = false) => {
    if (!acc) return;
    const bad = rows.findIndex((r) => !r.title.trim() || r.title.length > 100 || (!asDraft && !r.when));
    if (bad >= 0) return setMsg(`Vídeo ${bad + 1}: título vazio/maior que 100 caracteres ou sem horário.`);
    setBusy(true); let ok = 0;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.state === "ok") { ok++; continue; }
      try {
        set(i, "state", "enviando…");
        const { url } = await uploadMedia(r.file);
        const { error } = await supabase.from("yt_videos").insert({
          account_id: acc.id, title: r.title.trim(), description: r.description, tags: r.tags, video_url: url, file_name: r.file.name,
          publish_at: parseWhen(r.when || toLocalInput(new Date(Date.now() + 86400000))).toISOString(), status: asDraft ? "draft" : "queued" });
        if (error) throw error;
        set(i, "state", "ok"); ok++;
      } catch (e: any) { set(i, "state", "erro: " + (e.message || e)); }
    }
    setBusy(false);
    setMsg(ok === rows.length ? `${ok} vídeos na fila. Veja em Agenda.` : `${ok}/${rows.length} enviados. Os com erro podem ser reenviados clicando de novo.`);
  };

  return (
    <div className="space-y-4">
      <h1 className="font-serif text-2xl text-gold">Novo vídeo (um ou vários)</h1>
      <div className="card space-y-3 text-sm">
        <label className="block">1) Vídeos (MP4)<input type="file" multiple accept="video/mp4,video/*" className="inp mt-1" onChange={(e) => onFiles(e.target.files)} /></label>
        <label className="block">2) Opcional: TITULOS_LEGENDAS_TAGS.txt (preenche título, descrição e tags pelo nome do arquivo)
          <input type="file" accept=".txt" className="inp mt-1" onChange={(e) => onNotes(e.target.files)} /></label>
        <p className="text-xs text-cream/50">Os horários são distribuídos nos próximos horários livres: {(acc?.slots || []).join(" · ")}. Dá para editar cada um.</p>
      </div>
      {rows.map((r, i) => (
        <div key={i} className="card space-y-2 text-sm">
          <div className="flex gap-2 items-center flex-wrap">
            <span className="text-xs text-cream/50 truncate max-w-[14rem]">{r.file.name} · {(r.file.size / 1048576).toFixed(1)} MB</span>
            {r.file.size > MAXMB * 1048576 && <span className="text-xs text-red-400">passa de {MAXMB} MB (limite do Supabase grátis)</span>}
            <input type="datetime-local" className="inp !w-auto !py-1 text-xs ml-auto" value={r.when} onChange={(e) => set(i, "when", e.target.value)} />
            <span className="text-xs text-gold w-32 text-right truncate">{r.state}</span>
          </div>
          <input className="inp" value={r.title} onChange={(e) => set(i, "title", e.target.value)} placeholder="Título" />
          <div className={`text-[10px] text-right ${r.title.length > 100 ? "text-red-400" : "text-cream/40"}`}>{r.title.length}/100</div>
          <textarea className="inp" rows={3} value={r.description} onChange={(e) => set(i, "description", e.target.value)} placeholder="Descrição" />
          <input className="inp" value={r.tags} onChange={(e) => set(i, "tags", e.target.value)} placeholder="Tags separadas por vírgula" />
        </div>
      ))}
      {rows.length > 0 && (
        <div className="flex gap-3 items-center">
          <button className="btn" disabled={busy} onClick={() => send(false)}>{busy ? "Enviando…" : `Colocar ${rows.length} na fila`}</button>
          <button className="btn2" disabled={busy} onClick={() => send(true)}>salvar como rascunho</button>
        </div>
      )}
      {msg && <p className="text-xs text-cream/70">{msg}</p>}
    </div>
  );
}

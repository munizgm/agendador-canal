"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { uploadMedia } from "@/components/Uploader";

const TYPES = [["feed", "Post estático"], ["carousel", "Carrossel"], ["reel", "Reel"], ["story", "Story"]] as const;

function localNow(plusMin = 60) {
  const d = new Date(Date.now() + plusMin * 60000 - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function Novo() {
  const [accs, setAccs] = useState<any[]>([]);
  const [account, setAccount] = useState("");
  const [type, setType] = useState<string>("feed");
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [when, setWhen] = useState(localNow());
  const [files, setFiles] = useState<File[]>([]);
  const [cover, setCover] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { supabase.from("accounts").select("id,name").then(({ data }) => { setAccs(data || []); if (data?.[0]) setAccount(data[0].id); }); }, []);

  const multi = type === "carousel";
  async function submit(asDraft: boolean) {
    setMsg("");
    if (!account) return setMsg("Conecte uma conta em 'Conta' primeiro.");
    if (!files.length) return setMsg("Escolha a mídia.");
    if (type === "reel" && files[0].type.startsWith("image/")) return setMsg("Reel precisa de vídeo.");
    if (type === "carousel" && (files.length < 2 || files.length > 10)) return setMsg("Carrossel: de 2 a 10 arquivos.");
    setBusy(true);
    try {
      const ups = [];
      for (const f of files) ups.push(await uploadMedia(f));
      const cover_url = cover ? (await uploadMedia(cover)).url : null;
      const { data: post, error } = await supabase.from("posts").insert({
        account_id: account, type, title, caption, cover_url,
        scheduled_at: new Date(when).toISOString(), status: asDraft ? "draft" : "scheduled",
      }).select("id").single();
      if (error) throw error;
      const { error: e2 } = await supabase.from("post_media").insert(ups.map((u, i) => ({ post_id: post!.id, position: i, url: u.url, kind: u.kind })));
      if (e2) throw e2;
      location.href = "/posts";
    } catch (e: any) { setMsg(e.message || String(e)); setBusy(false); }
  }

  return (
    <div className="card space-y-4 max-w-2xl">
      <h1 className="font-serif text-2xl text-gold">Novo post</h1>
      <div className="flex gap-2 flex-wrap">
        {TYPES.map(([k, l]) => (
          <button key={k} onClick={() => { setType(k); setFiles([]); }} className={`btn2 ${type === k ? "!border-gold text-gold" : ""}`}>{l}</button>
        ))}
      </div>
      {accs.length > 1 && (
        <select className="inp" value={account} onChange={(e) => setAccount(e.target.value)}>{accs.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
      )}
      <input className="inp" placeholder="Título interno (ex.: Reel 05 – Boécio)" value={title} onChange={(e) => setTitle(e.target.value)} />
      <div>
        <label className="text-xs text-cream/60">{multi ? "Slides (2 a 10, na ordem)" : type === "reel" ? "Vídeo do Reel (.mp4)" : "Imagem"}</label>
        <input className="inp" type="file" multiple={multi} accept={type === "reel" ? "video/*" : type === "story" ? "image/*,video/*" : "image/*"}
          onChange={(e) => setFiles(Array.from(e.target.files || []).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })))} />
        {files.length > 0 && <p className="text-xs text-cream/50 mt-1">{files.map((f) => f.name).join(" → ")}</p>}
      </div>
      {type === "reel" && (
        <div>
          <label className="text-xs text-cream/60">Capa do Reel (imagem 9:16, opcional)</label>
          <input className="inp" type="file" accept="image/*" onChange={(e) => setCover(e.target.files?.[0] || null)} />
        </div>
      )}
      {type !== "story" && (
        <textarea className="inp" rows={8} placeholder="Legenda" value={caption} onChange={(e) => setCaption(e.target.value)} />
      )}
      <div>
        <label className="text-xs text-cream/60">Publicar em</label>
        <input className="inp" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
      </div>
      {msg && <p className="text-sm text-red-400">{msg}</p>}
      <div className="flex gap-2">
        <button disabled={busy} className="btn" onClick={() => submit(false)}>{busy ? "Enviando…" : "Agendar"}</button>
        <button disabled={busy} className="btn2" onClick={() => submit(true)}>Salvar rascunho</button>
      </div>
    </div>
  );
}

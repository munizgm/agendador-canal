"use client";
import { useEffect, useState } from "react";
import { getYtAccount } from "@/lib/ytclient";
import { supabase } from "@/lib/supabase";

export default function YtConta() {
  const [a, setA] = useState<any>(null);
  const [slots, setSlots] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => { getYtAccount().then((x) => { setA(x); setSlots((x.slots as string[]).join(", ")); }); }, []);
  if (!a) return null;
  const save = async () => {
    const list = slots.split(/[,\s]+/).filter(Boolean);
    if (!list.every((s) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s))) return setMsg("Horários inválidos. Use HH:MM separados por vírgula.");
    const norm = list.map((s) => s.padStart(5, "0"));
    const { error } = await supabase.from("yt_accounts").update({ name: a.name, channel_url: a.channel_url, category_id: a.category_id, slots: norm }).eq("id", a.id);
    setMsg(error ? error.message : `Salvo (${norm.length} horários por dia).`);
  };
  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="font-serif text-2xl text-gold">Conta do YouTube</h1>
      <div className="card space-y-3">
        <label className="block text-xs text-cream/60">Nome do canal<input className="inp mt-1" value={a.name} onChange={(e) => setA({ ...a, name: e.target.value })} /></label>
        <label className="block text-xs text-cream/60">Link do canal<input className="inp mt-1" value={a.channel_url || ""} onChange={(e) => setA({ ...a, channel_url: e.target.value })} /></label>
        <label className="block text-xs text-cream/60">Horários diários (Brasília), separados por vírgula
          <textarea className="inp mt-1" rows={2} value={slots} onChange={(e) => setSlots(e.target.value)} /></label>
        <label className="block text-xs text-cream/60">Categoria padrão (ID do YouTube; 22 = Pessoas e blogs, 24 = Entretenimento, 27 = Educação)
          <input className="inp mt-1" value={a.category_id} onChange={(e) => setA({ ...a, category_id: e.target.value })} /></label>
        <button className="btn" onClick={save}>Salvar</button>{msg && <span className="text-xs ml-3 text-cream/70">{msg}</span>}
      </div>
      <p className="text-xs text-cream/50">O login do YouTube fica na credencial “{a.name}” dentro do n8n (OAuth do Google), não aqui.</p>
    </div>
  );
}

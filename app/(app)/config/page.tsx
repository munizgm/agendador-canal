"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Config() {
  const [accs, setAccs] = useState<any[]>([]);
  const [f, setF] = useState({ name: "@seu_usuario", ig_user_id: "", access_token: "" });
  const [msg, setMsg] = useState("");
  const load = () => supabase.from("accounts").select("id,name,ig_user_id,created_at").then(({ data }) => setAccs(data || []));
  useEffect(() => { load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setMsg("");
    const { error } = await supabase.from("accounts").insert(f);
    if (error) setMsg(error.message); else { setF({ ...f, ig_user_id: "", access_token: "" }); setMsg("Conta salva."); load(); }
  }
  async function del(id: string) { if (confirm("Remover conta e posts dela?")) { await supabase.from("accounts").delete().eq("id", id); load(); } }
  return (
    <div className="space-y-6">
      <section className="card space-y-2">
        <h2 className="font-semibold">Contas conectadas</h2>
        {accs.length === 0 && <p className="text-sm text-cream/60">Nenhuma ainda.</p>}
        {accs.map((a) => (
          <div key={a.id} className="flex items-center justify-between text-sm border-t border-line pt-2">
            <span>{a.name} <span className="text-cream/40">· {a.ig_user_id}</span></span>
            <button className="btn2" onClick={() => del(a.id)}>remover</button>
          </div>
        ))}
      </section>
      <form onSubmit={save} className="card space-y-3">
        <h2 className="font-semibold">Conectar conta do Instagram</h2>
        <input className="inp" placeholder="Nome (@usuario)" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className="inp" placeholder="Instagram User ID (número)" value={f.ig_user_id} onChange={(e) => setF({ ...f, ig_user_id: e.target.value })} />
        <textarea className="inp" rows={3} placeholder="Token de acesso (Page token de longa duração)" value={f.access_token} onChange={(e) => setF({ ...f, access_token: e.target.value })} />
        {msg && <p className="text-xs text-gold">{msg}</p>}
        <button className="btn">Salvar</button>
      </form>
    </div>
  );
}

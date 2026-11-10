"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function Login() {
  const [email, setEmail] = useState(""); const [pw, setPw] = useState(""); const [err, setErr] = useState("");
  async function go(e: React.FormEvent) {
    e.preventDefault(); setErr("");
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message); else location.href = "/posts";
  }
  return (
    <main className="min-h-screen grid place-items-center p-6">
      <form onSubmit={go} className="card w-full max-w-sm space-y-3">
        <h1 className="font-serif text-2xl text-gold">Agenda de Posts</h1>
        <input className="inp" type="email" placeholder="e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="inp" type="password" placeholder="senha" value={pw} onChange={(e) => setPw(e.target.value)} />
        {err && <p className="text-red-400 text-xs">{err}</p>}
        <button className="btn w-full">Entrar</button>
      </form>
    </main>
  );
}

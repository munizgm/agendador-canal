"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { supabase } from "@/lib/supabase";

const nav = [["/youtube", "Agenda"], ["/youtube/novo", "Novo vídeo"], ["/youtube/postados", "Já postado"], ["/youtube/metricas", "Métricas"], ["/youtube/conta", "Conta"]];

export default function YtLayout({ children }: { children: React.ReactNode }) {
  const [ok, setOk] = useState(false);
  const path = usePathname();
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (!data.session) location.href = "/login"; else setOk(true); });
  }, []);
  if (!ok) return null;
  return (
    <div className="max-w-5xl mx-auto p-4">
      <header className="flex items-center gap-4 mb-6 flex-wrap">
        <span className="font-serif text-xl text-gold mr-4">YouTube</span>
        {nav.map(([h, l]) => (
          <Link key={h} href={h} className={`text-sm ${(h === "/youtube" ? path === h : path.startsWith(h)) ? "text-gold" : "text-cream/70 hover:text-cream"}`}>{l}</Link>
        ))}
        <Link href="/posts" className="ml-auto text-xs text-cream/50 hover:text-cream">← Instagram</Link>
        <button className="text-xs text-cream/50" onClick={() => supabase.auth.signOut().then(() => (location.href = "/login"))}>sair</button>
      </header>
      {children}
    </div>
  );
}

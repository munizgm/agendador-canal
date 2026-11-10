// Utilidades do módulo YouTube (separado do Instagram). Horário de Brasília = UTC-3 (sem horário de verão).
export const DEFAULT_SLOTS = ["08:00", "09:00", "10:00", "12:00", "13:30", "15:00", "17:00", "18:00", "19:00", "21:00"];

export const brt = (iso: string | Date) =>
  new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
export const brtDay = (iso: string | Date) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "short", day: "2-digit", month: "2-digit" });

/** "2026-10-31T09:00" (sem fuso) => horário de Brasília */
export function parseWhen(s: string): Date {
  const iso = /([zZ]|[+-]\d{2}:?\d{2})$/.test(s) ? s : s.replace(" ", "T") + "-03:00";
  const d = new Date(iso);
  if (isNaN(d.getTime())) throw new Error("data/hora inválida: " + s);
  return d;
}

/** Próximos `count` horários livres, respeitando os slots diários e ocupados (ms UTC). */
export function nextSlots(slots: string[], taken: Set<number>, count: number, from = new Date()): Date[] {
  const out: Date[] = [];
  const minT = from.getTime() + 20 * 60 * 1000; // pelo menos 20 min no futuro
  const sorted = [...slots].sort();
  const start = new Date(from.getTime() - 3 * 3600 * 1000); // "hoje" em Brasília
  for (let d = 0; d < 400 && out.length < count; d++) {
    const day = new Date(start.getTime() + d * 86400000).toISOString().slice(0, 10);
    for (const s of sorted) {
      const t = parseWhen(`${day}T${s}`).getTime();
      if (t >= minT && !taken.has(t)) { out.push(new Date(t)); taken.add(t); if (out.length >= count) break; }
    }
  }
  return out;
}

/** Converte Date => "YYYY-MM-DDTHH:mm" no horário de Brasília (para <input type=datetime-local>) */
export const toLocalInput = (d: Date) => new Date(d.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 16);

/** Lê o TITULOS_LEGENDAS_TAGS.txt: blocos "=== arquivo.mp4 ===" com TÍTULO (YouTube), DESCRIÇÃO (YouTube), TAGS. */
export function parseNotes(txt: string) {
  const res: Record<string, { title: string; description: string; tags: string }> = {};
  const blocks = txt.split(/^=== (.+?) ===\s*$/m);
  for (let i = 1; i < blocks.length; i += 2) {
    const name = blocks[i].trim(); const body = blocks[i + 1] || "";
    const title = (body.match(/^T[ÍI]TULO[^\n:]*:\s*(.+)$/m)?.[1] || "").trim();
    const description = (body.match(/^DESCRI[ÇC][ÃA]O \(YouTube\)[^\n]*:\s*\n([\s\S]*?)(?=\n(?:LEGENDA|TAGS)[^\n]*:|(?![\s\S]))/m)?.[1] || "").trim();
    const tags = (body.match(/^TAGS[^\n]*:\s*\n?(.+)$/m)?.[1] || "").trim();
    res[name] = { title, description, tags };
  }
  return res;
}

export const cronOk = (req: Request) => req.headers.get("x-cron-secret") === process.env.CRON_SECRET;

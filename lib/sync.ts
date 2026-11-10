import { admin } from "@/lib/admin";
import { ig } from "@/lib/instagram";

/** Importa tudo que já está publicado no feed/Reels (até ~300 itens) para a tabela ig_media. */
export async function syncMedia() {
  const db = admin();
  const { data: accounts } = await db.from("accounts").select("*");
  const out: any[] = [];
  for (const a of accounts || []) {
    let n = 0;
    try {
      let after: string | undefined;
      for (let page = 0; page < 3; page++) {
        const j: any = await ig(`${a.ig_user_id}/media`, a.access_token, "GET", {
          fields: "id,caption,media_type,media_product_type,permalink,timestamp", limit: 100, after,
        });
        const rows = (j.data || []).map((m: any) => ({
          ig_media_id: m.id, account_id: a.id, caption: m.caption || "", media_type: m.media_type,
          product_type: m.media_product_type, permalink: m.permalink, posted_at: m.timestamp,
        }));
        if (rows.length) await db.from("ig_media").upsert(rows, { onConflict: "ig_media_id" });
        n += rows.length;
        after = j.paging?.cursors?.after;
        if (!j.paging?.next) break;
      }
      out.push({ account: a.name, imported: n });
    } catch (e: any) { out.push({ account: a.name, error: e.message }); }
  }
  return out;
}

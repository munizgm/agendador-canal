const V = process.env.GRAPH_VERSION || "v23.0";
// Token do "Instagram API com login do Instagram" começa com IG...; usa graph.instagram.com.
// Token de Página (login do Facebook) usa graph.facebook.com.
const baseFor = (token: string) =>
  token.startsWith("IG") ? `https://graph.instagram.com/${V}` : `https://graph.facebook.com/${V}`;

export async function ig(path: string, token: string, method: "GET" | "POST" = "GET", params: Record<string, any> = {}) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) body.set(k, String(v));
  body.set("access_token", token);
  const BASE = baseFor(token);
  const res = await fetch(method === "GET" ? `${BASE}/${path}?${body}` : `${BASE}/${path}`, {
    method,
    ...(method === "POST" ? { body } : {}),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error?.message || `HTTP ${res.status}`);
  return json;
}

export async function statusOf(container: string, token: string) {
  const j = await ig(container, token, "GET", { fields: "status_code,status" });
  return { code: j.status_code as string, detail: j.status as string | undefined };
}

type Media = { url: string; kind: "image" | "video" };

/** Cria o(s) container(s) no Instagram. Retorna o id do container final (+ filhos do carrossel). */
export async function createContainer(
  igUser: string, token: string,
  p: { type: string; caption: string; cover_url?: string | null; share_to_feed?: boolean | null },
  media: Media[]
) {
  const caption = p.caption || "";
  if (p.type === "feed") {
    const m = media[0];
    const j = await ig(`${igUser}/media`, token, "POST", { image_url: m.url, caption });
    return { id: j.id as string, children: null as string[] | null };
  }
  if (p.type === "story") {
    const m = media[0];
    const params: any = m.kind === "video" ? { media_type: "STORIES", video_url: m.url } : { media_type: "STORIES", image_url: m.url };
    const j = await ig(`${igUser}/media`, token, "POST", params);
    return { id: j.id as string, children: null };
  }
  if (p.type === "reel") {
    const m = media[0];
    const j = await ig(`${igUser}/media`, token, "POST", {
      media_type: "REELS", video_url: m.url, caption,
      cover_url: p.cover_url || undefined, share_to_feed: p.share_to_feed ?? true,
    });
    return { id: j.id as string, children: null };
  }
  if (p.type === "carousel") {
    const children: string[] = [];
    for (const m of media) {
      const j = await ig(`${igUser}/media`, token, "POST",
        m.kind === "video"
          ? { media_type: "VIDEO", video_url: m.url, is_carousel_item: true }
          : { image_url: m.url, is_carousel_item: true });
      children.push(j.id);
    }
    const j = await ig(`${igUser}/media`, token, "POST", {
      media_type: "CAROUSEL", children: children.join(","), caption,
    });
    return { id: j.id as string, children };
  }
  throw new Error("Tipo desconhecido: " + p.type);
}

export async function publish(igUser: string, token: string, container: string) {
  const j = await ig(`${igUser}/media_publish`, token, "POST", { creation_id: container });
  const info = await ig(j.id, token, "GET", { fields: "permalink" }).catch(() => ({} as any));
  return { mediaId: j.id as string, permalink: (info.permalink as string) || null };
}

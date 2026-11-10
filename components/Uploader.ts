import { supabase } from "@/lib/supabase";

/** Converte imagem para JPEG (o Instagram só aceita JPEG) e sobe pro bucket público. */
async function toJpeg(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  const ctx = c.getContext("2d")!; ctx.fillStyle = "#000"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(bmp, 0, 0);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("falha ao converter"))), "image/jpeg", 0.92));
}

export async function uploadMedia(file: File): Promise<{ url: string; kind: "image" | "video" }> {
  const { data: u } = await supabase.auth.getUser();
  const isVideo = file.type.startsWith("video/");
  const body: Blob = isVideo ? file : await toJpeg(file);
  const ext = isVideo ? "mp4" : "jpg";
  const path = `${u.user!.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("media").upload(path, body, { contentType: isVideo ? "video/mp4" : "image/jpeg" });
  if (error) throw error;
  return { url: supabase.storage.from("media").getPublicUrl(path).data.publicUrl, kind: isVideo ? "video" : "image" };
}

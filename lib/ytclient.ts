import { supabase } from "@/lib/supabase";
/** Pega a conta do YouTube; cria uma conta padrão automaticamente na primeira vez. */
export async function getYtAccount() {
  const { data } = await supabase.from("yt_accounts").select("*").limit(1);
  if (data && data[0]) return data[0];
  const { data: c, error } = await supabase.from("yt_accounts").insert({}).select("*").single();
  if (error) throw error;
  return c;
}

import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Без этих двух переменных окружения аккаунты компаний просто выключены —
// тренажёр работает как раньше, анонимно, без входа (это важно: жюри должно
// уметь запустить прототип без регистрации).
export const supabaseEnabled = Boolean(url && anonKey);
export const supabase = supabaseEnabled ? createClient(url, anonKey) : null;

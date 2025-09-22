const { createClient } = require("@supabase/supabase-js");

// Configurar cliente de Supabase para Vercel Edge Functions
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing Supabase configuration");
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

module.exports = supabase;

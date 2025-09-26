import { createClient } from "@supabase/supabase-js";

const url =
  process.env.SUPABASE_URL || "https://svagwessyvbjrvmnfbhu.supabase.co";
const anon =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWd3ZXNzeXZianJ2bW5mYmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTk5NDUsImV4cCI6MjA3Mzk3NTk0NX0.-0Z61AWIZCLlXZ1pYg3JYikLpUSD5InlzfUNKBesMug";
("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN2YWd3ZXNzeXZianJ2bW5mYmh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTgzOTk5NDUsImV4cCI6MjA3Mzk3NTk0NX0.-0Z61AWIZCLlXZ1pYg3JYikLpUSD5InlzfUNKBesMug");

export const supabase = createClient(url, anon);

import { createClient } from '@supabase/supabase-js';

// Use lazy initialization to avoid crashing during build when env vars are missing
let supabaseAdminClient: any = null;

export const getSupabaseAdmin = () => {
  if (supabaseAdminClient) return supabaseAdminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    // During build time on Vercel, these might be missing. 
    // We throw a clear error only when actually called.
    throw new Error('Supabase Admin environment variables (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) are missing.');
  }

  supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);
  return supabaseAdminClient;
};

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { createSupabaseFetch, getSupabaseServiceRoleKey, getSupabaseUrl } from './supabase-env';

// Service-role client for the project's own Supabase instance. Server only.
export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();

  if (!url || !serviceRoleKey) {
    const missing = [...(!url ? ['SUPABASE_URL'] : []), ...(!serviceRoleKey ? ['SERVICE_ROLE_KEY'] : [])];
    throw new Error(`Missing Supabase environment variable(s): ${missing.join(', ')}.`);
  }

  return createClient<Database>(url, serviceRoleKey, {
    global: { fetch: createSupabaseFetch(serviceRoleKey) },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

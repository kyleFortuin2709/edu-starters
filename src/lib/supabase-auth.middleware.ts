import { createMiddleware } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { createSupabaseFetch, getSupabasePublishableKey, getSupabaseUrl } from './supabase-env';

// Same contract as the generated requireSupabaseAuth, but resolves the
// connection through supabase-env so it always targets the project's own
// Supabase instance.
export const requireSupabaseAuth = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();

  if (!url || !publishableKey) {
    throw new Error('Missing Supabase environment variables for the server client.');
  }

  const request = getRequest();
  const authHeader = request?.headers?.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: No authorization header provided');
  }

  const token = authHeader.replace('Bearer ', '');
  if (!token || token.split('.').length !== 3) {
    throw new Error('Unauthorized: Invalid token');
  }

  const supabase = createClient<Database>(url, publishableKey, {
    global: {
      fetch: createSupabaseFetch(publishableKey),
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    throw new Error('Unauthorized: Invalid token');
  }

  return next({ context: { supabase, userId: data.claims.sub, claims: data.claims } });
});

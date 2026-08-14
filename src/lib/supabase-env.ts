// Resolves the Supabase connection used by server code.
// The project points at a self-owned Supabase project, so the URL/publishable
// key come from the VITE_* values in .env (the same ones the browser client
// uses). The service role key is read from the SERVICE_ROLE_KEY secret
// (SUPABASE_* is a reserved secret prefix and can hold a stale value).
export function getSupabaseUrl(): string {
  return (
    import.meta.env['VITE_SUPABASE_URL'] ??
    process.env['VITE_SUPABASE_URL'] ??
    process.env['SUPABASE_URL'] ??
    ''
  );
}

export function getSupabasePublishableKey(): string {
  return (
    import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ??
    process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ??
    process.env['SUPABASE_PUBLISHABLE_KEY'] ??
    ''
  );
}

export function getSupabaseServiceRoleKey(): string {
  return process.env['SERVICE_ROLE_KEY'] ?? process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
}

export function isOpaqueSupabaseKey(value: string): boolean {
  return value.startsWith('sb_publishable_') || value.startsWith('sb_secret_');
}

export function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isOpaqueSupabaseKey(supabaseKey) && headers.get('Authorization') === `Bearer ${supabaseKey}`) {
      headers.delete('Authorization');
    }
    headers.set('apikey', supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

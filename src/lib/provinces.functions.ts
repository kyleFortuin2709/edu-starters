import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";
import { getSupabaseAdmin } from "@/lib/supabase-admin.server";

const ALL_SA_PROVINCES = [
  { code: "EC", name: "Eastern Cape", sort_order: 1 },
  { code: "FS", name: "Free State", sort_order: 2 },
  { code: "GP", name: "Gauteng", sort_order: 3 },
  { code: "KZN", name: "KwaZulu-Natal", sort_order: 4 },
  { code: "LP", name: "Limpopo", sort_order: 5 },
  { code: "MP", name: "Mpumalanga", sort_order: 6 },
  { code: "NC", name: "Northern Cape", sort_order: 7 },
  { code: "NW", name: "North West", sort_order: 8 },
  { code: "WC", name: "Western Cape", sort_order: 9 },
];

/**
 * Ensures all nine South African provinces exist in the project's database.
 * Uses the service-role client so it can insert into the provinces table
 * regardless of RLS.
 */
export const ensureAllProvinces = createServerFn({ method: "POST" }).handler(async () => {
  const admin = getSupabaseAdmin();

  const { data: existing } = await admin.from("provinces").select("code");
  const existingCodes = new Set((existing ?? []).map((p) => p.code));

  const missing = ALL_SA_PROVINCES.filter((p) => !existingCodes.has(p.code));
  if (missing.length === 0) {
    return { created: 0, codes: ALL_SA_PROVINCES.map((p) => p.code) };
  }

  const { error, data } = await admin.from("provinces").insert(missing).select("code");
  if (error) throw error;

  return { created: data?.length ?? 0, codes: ALL_SA_PROVINCES.map((p) => p.code) };
});

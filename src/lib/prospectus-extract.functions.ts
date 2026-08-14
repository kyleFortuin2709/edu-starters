import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/lib/supabase-auth.middleware";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase-env";

const TIMEOUT_MS = 120_000;

export type ExtractionRunResult = {
  stagedCount: number;
  documentFlags: string[];
  apsMethodologyFound: boolean;
};

export const extractProspectus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ prospectusId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<ExtractionRunResult> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("We couldn't verify your admin access.");
    if (!isAdmin) throw new Error("Forbidden");

    const url = getSupabaseUrl();
    const apiKey = getSupabasePublishableKey();
    if (!url) throw new Error("The backend connection is not configured.");

    const token = getRequest()?.headers?.get("authorization") ?? "";

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(`${url}/functions/v1/extract-prospectus`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: token } : {}),
          ...(apiKey ? { apikey: apiKey } : {}),
        },
        body: JSON.stringify({ prospectusId: data.prospectusId }),
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("The extraction service took too long to respond. Please try again.");
      }
      throw new Error("We couldn't reach the extraction service. Please try again.");
    } finally {
      clearTimeout(timer);
    }

    const raw = await response.text();
    let payload: unknown = null;
    try {
      payload = raw ? JSON.parse(raw) : null;
    } catch {
      payload = null;
    }
    const body = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;

    if (!response.ok) {
      const message = typeof body["error"] === "string" ? body["error"] : "";
      console.error("prospectus extraction failed", response.status, raw.slice(0, 500));
      throw new Error(message || "We couldn't analyse that document. Please try again.");
    }

    const stagedCount = typeof body["stagedCount"] === "number" ? body["stagedCount"] : 0;
    const documentFlags = Array.isArray(body["documentFlags"])
      ? (body["documentFlags"] as unknown[]).filter((f): f is string => typeof f === "string")
      : [];

    return {
      stagedCount,
      documentFlags,
      apsMethodologyFound: Boolean(body["apsMethodologyFound"]),
    };
  });

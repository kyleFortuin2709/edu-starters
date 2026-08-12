import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const extractProspectus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ prospectusId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { runExtractionForProspectus } = await import("./prospectus-extract.run.server");
    return runExtractionForProspectus({
      prospectusId: data.prospectusId,
      userId: context.userId,
      supabase: context.supabase,
    });
  });
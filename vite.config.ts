// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    // This app intentionally uses the owner's external backend. Lovable's
    // managed preview environment can inject its own VITE_SUPABASE_* values,
    // so pin the public connection here to keep browser auth on that backend.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(
        "https://gvstaycljbazjjtkumqa.supabase.co",
      ),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd2c3RheWNsamJhempqdGt1bXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTcxNTEsImV4cCI6MjEwMjI3MzE1MX0.bR9i_dtdRNqPUf3u80QElAw7348CchQ4QrQG6dzQhAk",
      ),
    },
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});

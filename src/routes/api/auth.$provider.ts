import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const valid = params.provider === "google" || params.provider === "github" || params.provider === "cloudflare";
        if (!valid) return new Response("Not found", { status: 404 });
        const { startOAuth } = await import("@/lib/cloud/oauth.server");
        return startOAuth(request, params.provider);
      },
    },
  },
});

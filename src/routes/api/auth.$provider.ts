import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/auth/$provider")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (params.provider !== "google" && params.provider !== "github")
          return new Response("Not found", { status: 404 });
        const { startOAuth } = await import("@/lib/cloud/oauth.server");
        return await startOAuth(request, params.provider);
      },
    },
  },
});

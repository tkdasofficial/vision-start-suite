import { createFileRoute } from "@tanstack/react-router";

// Cloudflare Workers AI models chosen for Vision.
const MODELS = {
  general: "@cf/qwen/qwen3-30b-a3b-fp8",
  deep: "@cf/openai/gpt-oss-120b",
  code: "@cf/qwen/qwen2.5-coder-32b-instruct",
} as const;

const SYSTEM = "You are Vision, a helpful, concise AI assistant. Format answers in Markdown.";

function pickModel(text: string, toolId?: string) {
  if (toolId?.includes("code") || /```|\b(code|function|bug|typescript|javascript|python|react|sql|regex|api)\b/i.test(text)) return MODELS.code;
  if (text.length > 1200 || /\b(analy[sz]e|research|explain in detail|step[- ]by[- ]step|compare|plan)\b/i.test(text)) return MODELS.deep;
  return MODELS.general;
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { getCaller } = await import("@/lib/cloud/auth.server");
        const caller = await getCaller();
        if (!caller) return Response.json({ error: "Please sign in to chat." }, { status: 401 });
        {
          const { d1Store } = await import("@/lib/cloud/security.server");
          const { enforceLimits, SECURITY_CONFIG } = await import("../../../security");
          try { await enforceLimits(d1Store, [[`chat:user:${caller.user.id}`, SECURITY_CONFIG.limits.chatPerUser]]); }
          catch (e: any) { return Response.json({ error: e.message }, { status: 429 }); }
        }

        const body: any = await request.json().catch(() => null);
        const raw = Array.isArray(body?.messages) ? body.messages.slice(-30) : [];
        const messages = raw
          .map((m: any) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: typeof m.content === "string" ? m.content : Array.isArray(m.content) ? m.content.filter((p: any) => p.type === "text").map((p: any) => p.text).join("\n") : "",
          }))
          .filter((m: any) => m.content.trim())
          .map((m: any) => ({ ...m, content: m.content.slice(0, 20000) }));
        if (!messages.length) return Response.json({ error: "Message is empty." }, { status: 400 });

        const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
        const token = process.env["CLOUDFLARE_API_TOKEN"];
        if (!account || !token) return Response.json({ error: "AI is not configured." }, { status: 500 });

        const model = pickModel(messages[messages.length - 1].content, body?.toolId);
        const upstream = await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/ai/v1/chat/completions`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model, messages: [{ role: "system", content: model === MODELS.general ? `${SYSTEM} /no_think` : SYSTEM }, ...messages], stream: true, max_tokens: 4096 }),
          signal: request.signal,
        });
        if (!upstream.ok || !upstream.body) {
          console.error("[chat] workers ai", upstream.status, await upstream.text().catch(() => ""));
          const status = upstream.status === 429 ? 429 : 502;
          return Response.json({ error: status === 429 ? "AI is busy right now. Please try again in a moment." : "AI couldn't answer right now." }, { status });
        }
        return new Response(upstream.body, {
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store", "X-Vision-Model": model },
        });
      },
    },
  },
});

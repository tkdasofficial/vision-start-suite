// Streams an AI reply from the server's /api/chat endpoint (Cloudflare Workers AI).
export async function streamChat(
  messages: { role: string; content: any }[],
  onText: (full: string) => void,
  toolId?: string,
): Promise<string> {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, toolId }),
  });
  if (!resp.ok || !resp.body) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || "AI couldn't answer right now.");
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).replace(/\r$/, "");
      buf = buf.slice(idx + 1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const p = JSON.parse(json);
        const delta = p.choices?.[0]?.delta?.content ?? p.response;
        if (delta) { text += delta; onText(text); }
      } catch { /* partial line */ }
    }
  }
  // Some models wrap private reasoning in <think> tags; never show it.
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Index";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/incognito")({
  head: () => ({ meta: [
    { title: "Incognito Chat — Super Copilot" },
    { name: "description", content: "A temporary conversation that is not saved to your Super Copilot history." },
    { property: "og:title", content: "Incognito Chat — Super Copilot" },
    { property: "og:description", content: "Start a temporary, unsaved conversation in Super Copilot." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Protected><Page isIncognito /></Protected>,
});
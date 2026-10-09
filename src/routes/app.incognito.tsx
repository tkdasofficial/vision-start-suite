import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Index";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/incognito")({
  head: () => ({ meta: [
    { title: "Incognito Chat — Vision" },
    { name: "description", content: "A temporary conversation that is not saved to your Vision history." },
    { property: "og:title", content: "Incognito Chat — Vision" },
    { property: "og:description", content: "Start a temporary, unsaved conversation in Vision." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Protected><Page isIncognito /></Protected>,
});
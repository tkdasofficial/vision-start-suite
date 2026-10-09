import { createFileRoute } from "@tanstack/react-router";
import Search from "@/views/Search";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/search")({
  head: () => ({ meta: [
    { title: "Search chats, files and creations — Super Copilot" },
    { name: "description", content: "Find recent chats, uploaded files, and generated items in your Super Copilot workspace." },
    { property: "og:title", content: "Search your workspace — Super Copilot" },
    { property: "og:description", content: "Find your conversations, uploads, and generated creations in one place." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Protected><Search /></Protected>,
});
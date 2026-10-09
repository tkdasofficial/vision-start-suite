import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Library";
import { Protected } from "@/components/Protected";
export const Route = createFileRoute("/app/library")({
  head: () => ({ meta: [
    { title: "Library — Vision" },
    { name: "description", content: "Browse your uploaded files and saved creations in Vision." },
    { property: "og:title", content: "Library — Vision" },
    { property: "og:description", content: "Browse your uploaded files and saved creations in Vision." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: RouteComponent,
});
function RouteComponent() { return <Protected><Page /></Protected>; }

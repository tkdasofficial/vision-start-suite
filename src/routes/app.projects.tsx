import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Projects";
import { Protected } from "@/components/Protected";
export const Route = createFileRoute("/app/projects")({
  head: () => ({ meta: [
    { title: "Projects — Vision" },
    { name: "description", content: "Create and organize projects and link saved conversations in Vision." },
    { property: "og:title", content: "Projects — Vision" },
    { property: "og:description", content: "Create and organize projects and link saved conversations in Vision." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: RouteComponent,
});
function RouteComponent() { return <Protected><Page /></Protected>; }

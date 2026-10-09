import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Auth";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Sign up — Vision" },
      { name: "description", content: "Sign up in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Sign up — Vision" },
      { property: "og:description", content: "Sign up in Vision, your all-in-one AI workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}

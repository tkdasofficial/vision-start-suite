import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/Account";
import { Protected } from "@/components/Protected";

export const Route = createFileRoute("/app/account")({
  head: () => ({
    meta: [
      { title: "Account — Vision" },
      { name: "description", content: "Account in Vision, your all-in-one AI workspace." },
      { property: "og:title", content: "Account — Vision" },
      { property: "og:description", content: "Account in Vision, your all-in-one AI workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Protected><Page /></Protected>;
}

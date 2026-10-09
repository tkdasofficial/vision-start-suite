import { createFileRoute } from "@tanstack/react-router";
import Page from "@/views/admin/Subscriptions";

export const Route = createFileRoute("/admin/subscriptions")({
  head: () => ({
    meta: [
      { title: "Admin · Subscriptions — Super Copilot" },
      { name: "description", content: "Admin · Subscriptions in Super Copilot, your all-in-one AI workspace." },
      { property: "og:title", content: "Admin · Subscriptions — Super Copilot" },
      { property: "og:description", content: "Admin · Subscriptions in Super Copilot, your all-in-one AI workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RouteComponent,
});

function RouteComponent() {
  return <Page />;
}

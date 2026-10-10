import { createFileRoute } from "@tanstack/react-router";
import EnterpriseLogin from "@/views/EnterpriseLogin";

export const Route = createFileRoute("/enterprise/email")({
  head: () => ({ meta: [
    { title: "Enterprise email — Vision" },
    { name: "description", content: "Enter your work email to receive a Vision Enterprise Login code." },
    { property: "og:title", content: "Enterprise email — Vision" },
    { property: "og:description", content: "Enter your work email to receive a Vision Enterprise Login code." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <EnterpriseLogin page="email" />,
});

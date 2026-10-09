import { Image, Film, Library, FolderOpen, Plug } from "lucide-react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

const features = [
  { label: "Images", to: "/app/images", icon: Image },
  { label: "Videos", to: "/app/videos", icon: Film },
  { label: "Library", to: "/app/library", icon: Library },
  { label: "Projects", to: "/app/projects", icon: FolderOpen },
  { label: "Integrations", to: "/app/integrations", icon: Plug },
] as const;

export default function SidebarFeatures({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  return <nav aria-label="Workspace features" className="space-y-1 px-3 pt-3">
    {features.map(({ label, to, icon: Icon }) => <Button key={to} asChild variant="ghost" className={`h-11 w-full justify-start gap-3 rounded-lg px-3 ${pathname === to ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-sidebar-foreground"}`}>
      <Link to={to} onClick={onNavigate} aria-current={pathname === to ? "page" : undefined}><Icon className="size-4" /><span>{label}</span></Link>
    </Button>)}
  </nav>;
}
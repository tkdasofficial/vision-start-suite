import { useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { useNavigate } from "@/lib/router-compat";
import { useChatHistory } from "@/context/ChatHistoryContext";
import DesktopSidebar from "./DesktopSidebar";
import MobileSidebar from "./MobileSidebar";
import { Button } from "./ui/button";

export default function WorkspaceShell({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { history } = useChatHistory();
  const props = { onNewChat: () => navigate("/app/new"), onSelectChat: (id: string) => navigate(`/app/chat/${id}`), chatHistory: history, isMainChat: false };
  return <div className="flex h-[100dvh] overflow-hidden bg-background">
    <DesktopSidebar {...props} /><MobileSidebar {...props} open={open} onClose={() => setOpen(false)} />
    <main className="flex min-w-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-3 bg-transparent px-4 py-3">
        <Button variant="secondary" size="icon" className="rounded-full lg:hidden" aria-label="Open sidebar" title="Open sidebar" onClick={() => setOpen(true)}><Menu /></Button>
        <h1 className="font-display text-lg font-semibold">{title}</h1><div className="ml-auto">{actions}</div>
      </header>
      <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-8"><div className="mx-auto max-w-4xl">{children}</div></div>
    </main>
  </div>;
}
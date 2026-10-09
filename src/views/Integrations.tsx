import { useMemo, useState } from "react";
import { Mail, Youtube, Cloud, Calendar, Github, MessageSquare, FileText, Search, Plug } from "lucide-react";
import { toast } from "sonner";
import WorkspaceShell from "@/components/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const services = [
  { name: "Gmail", description: "Email and inbox", icon: Mail },
  { name: "YouTube", description: "Videos and channels", icon: Youtube },
  { name: "Google Drive", description: "Files and documents", icon: Cloud },
  { name: "Google Calendar", description: "Events and schedules", icon: Calendar },
  { name: "GitHub", description: "Repositories and code", icon: Github },
  { name: "Slack", description: "Channels and messages", icon: MessageSquare },
  { name: "Notion", description: "Pages and workspaces", icon: FileText },
];
export default function Integrations() {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => services.filter((service) => `${service.name} ${service.description}`.toLowerCase().includes(query.toLowerCase())), [query]);
  return <WorkspaceShell title="Integrations">
    <div className="relative mb-6"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search services and tools" aria-label="Search integrations" className="pl-9" /></div>
    <p role="status" className="mb-6 text-sm text-muted-foreground">Service connections are unavailable in this browser-only version.</p>
    <div className="grid gap-3 sm:grid-cols-2">
      {filtered.map(({ name, description, icon: Icon }) => <div key={name} className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3"><Icon className="size-6 shrink-0 text-foreground" /><div className="min-w-0"><h2 className="text-sm font-semibold">{name}</h2><p className="text-xs text-muted-foreground">{description}</p></div></div>
        <div className="mt-4 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Not connected</span><Button variant="outline" size="sm" onClick={() => toast.error(`${name} connections need an online service, which isn't part of this browser-only version.`)}><Plug />Connect</Button></div>
      </div>)}
    </div>
    {filtered.length === 0 && <p className="py-16 text-center text-muted-foreground">No services found</p>}
  </WorkspaceShell>;
}

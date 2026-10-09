import { useEffect, useState } from "react";
import { FolderOpen, Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useChatHistory } from "@/context/ChatHistoryContext";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/lib/cloud/client";
import WorkspaceShell from "@/components/WorkspaceShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { projectIcons } from "@/lib/project-options";

type Project = { id: string; name: string; icon?: string; category?: string; session_id?: string };
export default function Projects() {
  const { user } = useAuth();
  const { history } = useChatHistory();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    if (!user) return;
    const result = await supabase.from("workspace_projects").select("*").eq("user_id", user.id);
    if (result.error) toast.error(result.error.message); else setProjects(result.data || []);
    setLoading(false);
  };
  useEffect(() => { void load(); }, [user?.id]);
  const save = async () => {
    if (!user || !name.trim() || !editing) return;
    const result = await supabase.from("workspace_projects").update({ name: name.trim() }).eq("id", editing).eq("user_id", user.id);
    if (result.error) { toast.error(result.error.message); return; }
    setName(""); setEditing(null); void load();
  };
  const remove = async (project: Project) => {
    if (!user || !window.confirm(`Delete ${project.name}?`)) return;
    const result = await supabase.from("workspace_projects").delete().eq("id", project.id).eq("user_id", user.id);
    if (result.error) toast.error(result.error.message); else { setSelected(null); void load(); }
  };
  const attach = async (sessionId: string) => {
    if (!user || !selected) return;
    const result = await supabase.from("workspace_projects").update({ session_id: sessionId }).eq("id", selected).eq("user_id", user.id);
    if (result.error) toast.error(result.error.message); else void load();
  };
  const active = projects.find((project) => project.id === selected);
  return <WorkspaceShell title="Projects" backTo="/app/new" actions={<Button onClick={() => navigate("/app/project-create")}><Plus />Create</Button>}>
    {editing && <form className="mb-8 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); void save(); }}>
      <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Project name" aria-label="Project name" maxLength={100} />
      <Button type="submit" disabled={!name.trim()}>Save</Button>
      {editing && <Button type="button" variant="ghost" onClick={() => { setEditing(null); setName(""); }}>Cancel</Button>}
    </form>}
    {loading ? <p role="status">Loading…</p> : projects.length === 0 ? <div className="py-20 text-center text-muted-foreground"><FolderOpen className="mx-auto mb-4 size-8" /><p>No projects yet</p></div> : <div className="grid gap-3 sm:grid-cols-2">
      {projects.map((project) => { const Icon = projectIcons.find((entry) => entry.value === project.icon)?.icon || FolderOpen; return <div key={project.id} className={`flex items-center gap-2 rounded-lg border p-4 ${selected === project.id ? "border-ring bg-accent/40" : "border-border"}`}>
        <Button variant="ghost" className="h-auto min-w-0 flex-1 justify-start px-0" onClick={() => setSelected(project.id)}><Icon className="shrink-0" /><span className="min-w-0 text-left"><span className="block truncate">{project.name}</span><span className="block text-xs font-normal text-muted-foreground">{project.category || "General"}</span></span></Button>
        <Button variant="ghost" size="icon" aria-label={`Rename ${project.name}`} title="Rename project" onClick={() => { setEditing(project.id); setName(project.name); }}><Pencil /></Button>
        <Button variant="ghost" size="icon" aria-label={`Delete ${project.name}`} title="Delete project" onClick={() => void remove(project)}><Trash2 /></Button>
      </div>; })}
    </div>}
    {active && <section className="mt-8 border-t border-border pt-6"><h2 className="mb-4 text-lg font-semibold">{active.name}</h2>
      {active.session_id && <Button variant="outline" onClick={() => navigate(`/app/chat/${active.session_id}`)}>Open linked chat</Button>}
      <h3 className="my-4 text-sm text-muted-foreground">Link a chat</h3>
      {history.length === 0 ? <p className="text-sm text-muted-foreground">No saved chats yet</p> : history.map((chat) => <Button key={chat.id} variant="ghost" className="mb-1 w-full justify-start" onClick={() => void attach(chat.id)}>{chat.title}</Button>)}
    </section>}
  </WorkspaceShell>;
}

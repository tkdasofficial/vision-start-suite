export type SearchCategory = "chats" | "files" | "generated";
export type SearchItem = {
  id: string;
  category: SearchCategory;
  title: string;
  detail: string;
  sessionId?: string;
  date: string;
};

type Row = Record<string, any>;

export function collectSearchItems(sessions: Row[], messages: Row[], tasks: Row[], stories: Row[]): SearchItem[] {
  const items: SearchItem[] = sessions.map((session) => ({
    id: session.id, category: "chats", title: session.title || "Untitled chat",
    detail: session.preview || "", sessionId: session.id, date: session.created_at,
  }));
  const sessionIds = new Set(sessions.map((session) => session.id));
  for (const message of messages) {
    if (!sessionIds.has(message.session_id)) continue;
    const meta = message.metadata || {};
    const category = message.role === "user" ? "files" : "generated";
    const attachment = meta.generatedFile || meta.zipAnalysis || meta.convertFile || meta.attachment;
    if (message.image_url || attachment || meta.webApp || meta.videos?.length || meta.ttsScript || meta.videoGeneration) {
      items.push({
        id: `message-${message.id}`, category,
        title: attachment?.fileName || attachment?.name || (meta.webApp ? "Generated app" : message.image_url ? (category === "files" ? "Uploaded image" : "Generated image") : meta.videos?.length || meta.videoGeneration ? "Video" : "Audio"),
        detail: message.content || "", sessionId: message.session_id, date: message.created_at,
      });
    }
  }
  for (const task of tasks) {
    if (task.status !== "completed" || !task.result || task.result.type === "chat") continue;
    items.push({ id: `task-${task.id}`, category: "generated", title: task.result.fileName || task.input?.topic || task.input?.prompt || `Generated ${task.task_type}`, detail: task.result.explanation || task.task_type, sessionId: sessionIds.has(task.session_id) ? task.session_id : undefined, date: task.created_at });
  }
  for (const story of stories) {
    items.push({ id: `story-${story.id}`, category: "generated", title: story.title || "Story project", detail: story.status || "", sessionId: sessionIds.has(story.session_id) ? story.session_id : undefined, date: story.created_at });
  }
  return items.sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0));
}

export function filterSearchItems(items: SearchItem[], query: string, category: SearchCategory | "all") {
  const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((item) => (category === "all" || item.category === category) && words.every((word) => `${item.title} ${item.detail}`.toLocaleLowerCase().includes(word)));
}
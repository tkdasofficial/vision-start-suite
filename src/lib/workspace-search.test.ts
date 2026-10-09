import { describe, expect, it } from "vitest";
import { collectSearchItems, filterSearchItems } from "./workspace-search";

describe("workspace search", () => {
  const sessions = [{ id: "chat-1", title: "Launch plan", preview: "Summer campaign", created_at: "2026-10-09" }];
  it("indexes chats, uploaded files, generated messages and completed tasks", () => {
    const items = collectSearchItems(sessions, [
      { id: "upload", session_id: "chat-1", role: "user", metadata: { zipAnalysis: { fileName: "campaign.zip" } } },
      { id: "output", session_id: "chat-1", role: "assistant", metadata: { generatedFile: { fileName: "plan.pdf" } } },
      { id: "other-user", session_id: "other-chat", role: "user", image_url: "image" },
    ], [{ id: "task", status: "completed", task_type: "image", result: { type: "image" } }, { id: "pending", status: "running" }], []);
    expect(items.map((item) => item.title)).toEqual(expect.arrayContaining(["Launch plan", "campaign.zip", "plan.pdf", "Generated image"]));
    expect(items).toHaveLength(4);
    expect(filterSearchItems(items, "PLAN", "generated")).toHaveLength(1);
  });
  it("matches multiple words across titles and previews, and handles empty searches", () => {
    const items = collectSearchItems(sessions, [], [], []);
    expect(filterSearchItems(items, " launch SUMMER ", "all")).toHaveLength(1);
    expect(filterSearchItems(items, "missing", "all")).toEqual([]);
    expect(filterSearchItems(items, "", "all")).toHaveLength(1);
    expect(filterSearchItems(items, "", "files")).toEqual([]);
  });
});
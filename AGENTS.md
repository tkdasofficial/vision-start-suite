<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Page UIs live in `src/views/`; each `src/routes/*` file only wraps a view (and `<Protected>` for signed-in pages). Why: keeps ported screens separate from routing.
- Views navigate via `@/lib/router-compat` (thin adapter over TanStack Router). Why: lets ported code keep simple `navigate(path)` calls; never reintroduce react-router-dom.
- Backend is browser-only: `src/backend/` (localStorage tables + local auth) exposes a Supabase-shaped `supabase` object so views keep their query code. Why: user chose no online backend; AI/edge features return an "unavailable" error.
- The chat composer uses AI Elements PromptInput primitives; its existing file-routing callbacks remain separate from the primitive's attachment collection. Why: preserves ZIP/conversion behavior while sharing accessible input and submission controls.
- Speech text is joined through the browser-safe appendTranscript helper, with regression tests alongside existing tests. Why: preserves typed text and whitespace across recognition updates without coupling transcription to a service.
- Sidebar bottom actions share `SidebarActions`, and Search uses a protected route wrapping a view with browser-only reads of existing chat and task records. Why: keeps navigation consistent without introducing an online backend.
- Incognito uses a dedicated route and workspace-only React state, bypassing history writes, background jobs, and persistent AI generators. Why: temporary messages and attachments must never reach browser storage; AI remains unavailable in the browser-only app.

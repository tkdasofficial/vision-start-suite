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
- Backend is Cloudflare D1 reached from server code only (`src/lib/cloud/*.server.ts`); the browser `supabase`-shaped client in `src/lib/cloud/client.ts` sends every query to one server function that enforces per-table access rules. Why: user chose Cloudflare; keeps view query code unchanged while all permission checks run server-side.
- The chat composer uses AI Elements PromptInput primitives; its existing file-routing callbacks remain separate from the primitive's attachment collection. Why: preserves ZIP/conversion behavior while sharing accessible input and submission controls.
- Speech text is joined through the browser-safe appendTranscript helper, with regression tests alongside existing tests. Why: preserves typed text and whitespace across recognition updates without coupling transcription to a service.
- Sidebar bottom actions share `SidebarActions`, and Search uses a protected route wrapping a view with browser-only reads of existing chat and task records. Why: keeps navigation consistent without introducing an online backend.
- Incognito uses a dedicated route and workspace-only React state, bypassing history writes, background jobs, and persistent AI generators. Why: temporary messages and attachments must never reach browser storage; replies come from the stateless /api/chat route.

- Specialized Images and Videos routes reuse the Index workspace with a creation mode and reference presets; creation submissions terminate with the explicit unavailable status when the feature isn't set up. Why: preserves the shared layout without text-answer fallbacks or unsupported online calls.
- Sidebar feature links share SidebarFeatures, secondary collection pages share WorkspaceShell, and Library reuses Search filtered to assets. Why: keeps navigation and stored-item discovery consistent.
- Projects use user-scoped workspace_projects through the existing local backend adapter, with creation in a separate view and shared icon definitions. Why: preserves browser-local persistence and consistent icons across creation and listing.
- Library derives applicable file-type filters from the shared search index metadata. Why: avoids separate storage and keeps Search and Library classifications consistent.

- Sign-in uses PBKDF2 password hashes and hashed session tokens in D1 with an HttpOnly cookie; Google/GitHub OAuth callbacks live at /google/callback and /github/callback. Why: no third-party auth service; tokens never reach browser scripts.
- Every OAuth provider callback URL derives from `AUTH_ORIGIN` (env) or the request origin via `src/lib/cloud/oauth-urls.ts`; a new provider needs a `startOAuth` branch, a `profileFor` branch and a `/<provider>/callback` route. Why: a domain change updates one origin value and provider dashboards stay valid.
- Chat AI streams from Cloudflare Workers AI via the signed-in-only /api/chat server route, choosing a model per message. Why: user chose Workers AI for LLM only; keys stay on the server.- A Cloudflare Worker (`vision-auth` on `vision-app-auth.workers.dev`) proxies the published app URL and is the value of `AUTH_ORIGIN`; Google/GitHub dashboards point at it. Why: one stable callback origin — a future domain change only updates the Worker target and `AUTH_ORIGIN`.
- Email verification uses 8-digit codes hashed in D1 `auth_otps`, sent via Gmail SMTP (`src/lib/cloud/mail.server.ts`) with the saved Google app password; sender address is discovered from the Drive account and cached in `app_config`. Why: no third-party email service; codes never stored in plain text.
- User files upload to Google Drive per-type sub-folders via `src/lib/cloud/drive.server.ts`; D1 `user_files` holds the record and link, and browsers can only read their own rows (writes are server-only). Why: Drive is the file store, D1 is the index; chats never touch Drive.
- Security logic lives in root `security/` (pure TS, store-agnostic, tested in `security/tests`); `src/lib/cloud/security.server.ts` binds it to D1 and the request, and every signup entry point (email + OAuth) calls `evaluateSignup`. Why: one policy for all entry points; decisions stay server-side and testable without D1.
- Enterprise Login (VISION BDI) state lives in D1 `enterprise_attempts` keyed by an HttpOnly attempt cookie; logic is in `src/lib/cloud/enterprise.server.ts`, domain checks in `security/identity/domain-verification.ts`. Ownership is proven only by a DNS TXT challenge, and OTPs are bound to the attempt. Why: the browser never holds verification results, so steps can't be skipped by direct calls.

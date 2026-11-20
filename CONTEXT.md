# GitTasks — project context / handoff

Last updated: 2026-11-20

---

## 1. Goal / original requirements

Build a **fully client-side** web todo app:

- No server-side component. Browser talks directly to GitHub REST API using a PAT.
- Todo lists stored as `.md` files in a repository chosen by the user.
- Login: ask for PAT, then list all repos accessible with that token.
  - Private repos shown with a lock/"Private" badge.
  - Live repo search by name/description.
- On repo select: load all `.md` files as lists (multiple lists).
- Each file has two sections: `## Todo` and `## Completed`.
- Task fields: title, link, description, due date. All dates stored `yyyy-MM-dd`.
- Future (not implemented): repeat interval, last repeat, next repeat.
- Users can add tasks to any list, move tasks between lists.
- All changes committed immediately to GitHub via Contents API.
- Sleek modern UI, dark + light theme.
- Deployable to Cloudflare Pages from a different GitHub repo.

---

## 2. What exists now

Files in `D:\Work\_WIP_\todo`:

| File | Role |
|---|---|
| `index.html` | Shell, early theme script (prevents flash), fonts, mounts `app.js` |
| `assets/styles.css` | Design tokens, light/dark themes, all component styles |
| `assets/github.js` | `GitHubClient` — auth, repo listing, tree enumeration, file GET/PUT, UTF-8 base64 helpers |
| `assets/markdown.js` | `.md` parse/serialize for the todo format |
| `assets/app.js` | State, views, event handling, task operations, persistence |
| `README.md` | Features, token scopes, local run, Cloudflare Pages deployment |
| `CONTEXT.md` | This document |

**Stack:** vanilla ES modules, no build step, no dependencies. Static files only.

**Current build marker:** `APP_VERSION = '7'`, shown in sidebar footer as `v7`.
Use this to confirm a browser actually loaded the latest `app.js`.

---

## 3. Markdown file format

```md
# List title (display name comes from the FILENAME, not this heading)

## Todo

- [ ] Buy oat milk <!--{"due":"2026-11-22","link":"https://shop.example","desc":"Barred kind"}-->
- [ ] Simple task

## Completed

- [x] Bins out <!--{"due":"2026-11-18"}-->
```

- Metadata is compact JSON inside a trailing HTML comment.
  - Invisible when GitHub renders the file.
  - Lossless round-trip.
  - Unknown keys (e.g. future `repeat`, `lastRepeat`, `nextRepeat`) are preserved on save.
- Dates always `yyyy-MM-dd`.
- Parser preserves document preamble and any extra `##` sections it does not own.
- Serializer always writes `## Todo` and `## Completed` (adds them if missing).
- Files are named `<list>.md`. Display name = filename including `.md` (e.g. `README.md`).

---

## 4. GitHub API behaviour (important)

Implemented in `assets/github.js` + `commitList()` in `app.js`:

- Auth header: `Authorization: Bearer <PAT>`, plus `Accept: application/vnd.github+json` and `X-GitHub-Api-Version: 2022-11-28`.
- Verify: `GET /user`.
- Repos: `GET /user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member`, follows `Link: rel="next"` up to 10 pages.
- File discovery: `GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`, filtered to `.md` blobs; falls back to root `GET /contents` if tree is truncated.
- **Write pattern (critical):** before **every** PUT, do a fresh `GET /contents/{path}?ref={branch}` and use the SHA from that response. A 404 means the file does not exist yet → PUT with no SHA. This was adopted from `link-book-app`, which does GET-then-PUT on every mutation. Cached SHAs go stale and cause `422/409 "sha wasn't supplied"`.
- PUT body: `{ message, content (base64), branch, sha? }`.
- Base64 uses `TextEncoder`/`TextDecoder` for correct UTF-8.
- Errors: `GitHubClient.request` throws `Error` with `.message` and `.status`; 401/403 messages are rewritten to friendly text.

**Token scopes:** fine-grained PAT needs `Metadata: read` (implicit) + `Contents: read and write` on target repos. Classic PAT needs `repo` (private) or `public_repo` (public only).

---

## 5. Persistence / state

- Token: `sessionStorage` by default; `localStorage` if "Remember token on this device" is checked. Never sent anywhere except `api.github.com`.
- Last used repo: `localStorage['gittasks-repo']`.
  - Saved on successful repo open.
  - After login/reload, `connect()` reopens it automatically and skips the repo picker.
  - If saved repo is no longer accessible, key is removed and picker is shown.
  - Sign out clears token + saved repo.
- Theme: `localStorage['gittasks-theme']`, applied before paint in `index.html`.
- Task data is **not** cached locally; it always comes from GitHub.

---

## 6. UI / UX implemented

- Login card with visible 5-step "How to get a token" panel linking to `https://github.com/settings/personal-access-tokens/new`.
- Repo picker: search box, count, repo cards with private badge, description (ellipsis-truncated), relative updated time.
- Board: topbar (repo crumb, sync, user, theme, back to repos, logout), list sidebar with `+`, main area with Todo/Completed sections.
- Task card: title, description, due badge with overdue/soon styling, link badge, actions (edit, move, delete), tick checkbox.
- Modals: add/edit task, move to list, new list, delete confirmation.
- Toasts and a persistent error banner on the board.
- Responsive layout, dark/light theme.

**Save feedback:** ticking a task immediately moves it to Completed (optimistic) and shows a spinner in the checkbox; card dims and actions are disabled until the PUT completes. Failure reverts the tick and shows an error banner/toast.

---

## 7. Bugs found and fixed (chronological)

1. **Modal events not firing** — listeners were attached to `#app`, but modals live in `#modal-root`, a sibling. Fixed by listening on `document` for click/input/submit.
2. **Repo description overflow** — `.repo-desc`/`.repo-full` were inline `<span>`s so `text-overflow: ellipsis` had no effect. Fixed with `display:block`, `overflow:hidden`, `min-width:0` on flex child, `flex-shrink:0` on meta column.
3. **SHA error on save** (`422 "sha wasn't supplied"`) — cached SHA from initial load went stale. Fixed by fresh GET-before-every-PUT (pattern copied from `link-book-app`).
4. **Native form GET submission** — pressing Save submitted the form normally, producing `?id=&title=...&path=...` and reloading the page (which looked like being "booted out" to the repo picker). Fixed by:
   - Buttons are `type="button"` with explicit `data-action` (`connect`, `save-task`, `create-list`) handled by click delegation.
   - Capture-phase `document` submit listener calls `preventDefault()` first, with an idempotency guard and direct per-form listeners as redundancy.
   - `onsubmit="return false"` on all three forms.
5. **Auto-created `General.md`** — earlier version created it even when the repo already had `.md` files. Removed. Now existing `.md` files are the lists; if none exist, an empty state with "Create a list" is shown. A `General.md` already committed to a real repo is a leftover file — the app does not delete it; remove it manually in GitHub if unwanted.
6. **List naming confusion** — list title came from the file's H1 (a README with `# _todo` displayed as `_todo`). Now display name = filename (`README.md`).
7. **Repo selection not remembered** — fixed via `localStorage['gittasks-repo']` + auto-open on connect.
8. **No feedback on tick** — added per-task saving spinner/disabled state.

---

## 8. Verification performed

No test files are kept in the project. Verification was done with temporary `jsdom` + `esbuild` harnesses (installed under `%TEMP%`, removed afterwards), bundling `app.js` to IIFE and stubbing `window.fetch` with an in-memory GitHub API.

Scenarios verified:

- Login → repo list → private badge → search filter.
- Repo with only `README.md`: one list named `README.md`, no auto `General.md`, task written with `## Todo`/`## Completed` and `yyyy-MM-dd` date.
- Empty repo: empty state + create-list flow.
- Add / edit / complete / move between lists / delete with confirm; assertions against the resulting `.md` content.
- Fresh GET before PUT ordering.
- Stale-SHA rejection recovery (older iteration).
- Form submit `defaultPrevented`, no querystring, no navigation, using `requestSubmit()` and explicit button clicks.
- Repo persistence: first visit saves choice, return visit skips picker, stale key falls back to picker and is removed.
- Spinner/disabled state visible while a PUT is deliberately delayed, cleared afterwards.

Syntax checks: `node --check` on all three JS modules passed after each change.

---

## 9. Known limitations / future work

- Repeat fields (interval, last repeat, next repeat) are **not implemented**; the format preserves unknown metadata keys so this can be added later.
- No UI to delete a whole list/file (only tasks). `General.md` leftovers must be deleted in GitHub.
- No real conflict-resolution UI: a write re-reads the file then overwrites with the in-memory task set, which can clobber concurrent remote edits.
- Repo file discovery capped at the first 100 `.md` files.
- Content API errors surface as toast/banner; no retry queue for offline use.
- No automated test suite committed to the repo.

---

## 10. Deploy / run

- Local: `npx serve .` (ES modules need HTTP, not `file://`).
- Cloudflare Pages: connect the repo, framework **None**, build command empty, output dir `/`. No env vars/secrets needed.
- App lives in its own repo; it manages `.md` files in whatever repo the user selects at runtime.

---

## 11. Working preferences observed

- User prefers terse, caveman-style replies (per `AGENTS.caveman.md`), but technical substance, code, and security details must stay exact.
- User likes explicit visible status markers (the `v6` footer) to confirm which build is loaded.
- User reports issues with screenshots and exact URLs/error text; reproduce those precisely when debugging.

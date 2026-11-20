# GitTasks

A fully client-side todo application that stores each list as a Markdown (`.md`) file in a GitHub repository you choose. There is **no backend** — the browser talks directly to the GitHub REST API using a Personal Access Token (PAT).

## Features

- **PAT login** — enter a token, then pick from every repository it can access.
- **Repo search** — filter repositories by name/description as you type. Private repos show a 🔒 **Private** badge.
- **Remembers the last repository** — after login it reopens where you left off; use the back button in the topbar to switch.
- **Multiple lists** — every `.md` file in the repository is loaded as a list, named after its filename (e.g. `README.md`). Nothing is created automatically; use the **+** button to add your own lists.
- **Tasks** — title, due date (`yyyy-MM-dd`), link, and description. Toggle complete, edit, delete, and move between lists.
- **Live sync** — every change is committed to GitHub immediately via the Contents API.
- **Light / dark theme** — remembers your choice.
- **Static only** — no build step; deploy anywhere that serves static files.

## Markdown format

```md
# Groceries

## Todo

- [ ] Buy oat milk <!--{"due":"2026-11-22","link":"https://shop.example","desc":"Get the barred kind"}-->
- [ ] Clean the kitchen

## Completed

- [x] Take the bins out <!--{"due":"2026-11-18"}-->
```

Metadata is a compact JSON object inside a trailing HTML comment — invisible when GitHub renders the file, lossless when the app reads it. Dates are stored as `yyyy-MM-dd`. Unknown metadata keys are preserved, so future fields (repeat interval, last/next repeat) can be added without breaking existing files.

## Token permissions

- **Fine-grained PAT:** `Metadata: read` + `Contents: read and write` for the target repositories.
- **Classic PAT:** `repo` (private repos) or `public_repo` (public repos only).

Create a token at **GitHub → Settings → Developer settings → Personal access tokens**.

> **Security note:** the token stays in your browser. By default it is kept in `sessionStorage` (gone when the tab closes); if you check *Remember token on this device* it moves to `localStorage`. It is never transmitted anywhere except `api.github.com`. On a shared machine, leave "Remember" unchecked.

## Run locally

Any static file server works. From this folder:

```bash
npx serve .
# or
python -m http.server 8000
```

Then open the printed URL. (Opening `index.html` via `file://` will not work — ES modules require HTTP.)

## Deploy to Cloudflare Pages

This app lives in its **own repository**, separate from any repository whose todos it manages.

1. Push these files to a new GitHub repo.
2. In Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**.
3. Select that repo and the branch.
4. Build settings:
   - **Framework preset:** None
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
5. Deploy. Cloudflare serves the static files directly — no environment variables or secrets are needed.

Optional: add a `_redirects` file with `/* /index.html 200` if you later add client-side routing.

## Project structure

```
index.html            app shell + early theme setup
assets/styles.css     design tokens, light/dark themes, components
assets/github.js      GitHub REST client (auth, repos, tree, file read/write)
assets/markdown.js    .md parse/serialize for the todo format
assets/app.js         state, views, event handling
```

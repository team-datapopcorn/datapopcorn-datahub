# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repo structure

This is a monorepo of unrelated small projects, not a single application:

- `data-hub/` — React + Vite dashboard ("DATA POPCORN"). Single-page app (`src/App.jsx`) that renders a sidebar of data categories (external systems like Haerapy/Jeju Golf/restaurants, plus a personal hub: blood donation, diet, OOTD, environment, health, finance) and a generic table view driven off `src/sampleData.js`. All data is currently hardcoded sample data — there is no backend wired up; adding a new category means adding a key to `sampleData.js` and an entry to the `categories`/`personalData` arrays in `App.jsx`.
- `passid/` — React + Vite + Tailwind v4 landing page + editor for an AI ID-photo product ("PassID"). `src/App.jsx` is the marketing page; clicking "Start for Free" swaps to `src/components/Editor.jsx`, which uploads a photo and runs client-side background removal via `@imgly/background-removal` (WASM/GPU, runs entirely in-browser — no server upload). AI generation prompts (Korean-language, for external tools like Gemini) live in `src/constants/prompts.js` and are treated as a distinct, curated asset — edit the prompt text carefully, it's tuned for identity-preserving ID photo output.
- `wfc-map-gen/` — React + Vite scaffold, currently just a placeholder (`Map Canvas Placeholder`); no real logic yet.
- `neis-meal-api/` — NEIS Open API (Korean school meal/school info) scripts, decoupled from the three apps above:
  - `fetch_schools.py` — samples schools per region from the `schoolInfo` NEIS endpoint into `schools.json` (relative to this folder).
  - `fetch_meals_paginated.sh` — bash/curl pagination loop against the `mealServiceDietInfo` endpoint into `meals_all_pages.json` (relative to this folder).
  - `meal_pagination_workflow.json` / `school_data_workflow.json` — n8n workflow exports mirroring the same fetch logic as n8n nodes (manualTrigger → set/code → httpRequest → splitInBatches/code). Treat these as the canonical workflow definitions if editing the n8n automations; the shell/Python scripts are standalone equivalents, not generated from them.
  - `AGENT.md` / `MEAL_API_GUIDE.md` — reference docs for the NEIS meal API (params, response shape, allergy codes). Consult these before changing any meal-fetching code instead of guessing param names.
- `public-dataset/` — practice-data folders for AI tool education (Claude Code, Codex, etc.), grouped under one directory: `pdf/`, `csv/`, `excel/`, `image/`, `movie/`, `json/`, `audio/`, `txt/`, `zip/`, `sqlite/`, `html/`. Not wired into any app. Each subfolder has generated sample files plus a `README.md` describing what it's for and example exercises; `movie/` holds a link list (`sample_video_links.md`) to public sample mp4s instead of large video files.
- `datahub-mcp-server/` — Node/ESM MCP server, the target home for turning personal data sources into agent-callable tools (the long-term goal behind `data-hub`). One server, one tool module per source under `tools/` (`tools/neis.js` is the first, wrapping `neis-meal-api`'s live NEIS calls as `list_office_codes`/`search_schools`/`get_meals`). Two entrypoints share the same tool modules: `index.js` (stdio transport, for local Claude Code/Desktop use — spawned as a subprocess) and `http.js` (Streamable HTTP transport on `/mcp`, stateless per-request, meant to sit behind a reverse proxy for a public URL like `api.datapopcorn.ai/mcp`). Add a new source by writing `tools/<source>.js` with a `register<Source>Tools(server)` export and wiring it into both entrypoints. `http.js` currently has no auth — fine while only public NEIS data is exposed, but add an auth layer before wiring in personal (health/finance/etc.) sources. See `README.md`/`MANUAL.md` in that folder for setup and deployment steps.

## Commands

Each of `data-hub/`, `passid/`, `wfc-map-gen/` is an independent Vite project — run commands from inside that subdirectory:

```
npm install
npm run dev       # vite dev server
npm run build     # vite build
npm run lint      # eslint .
npm run preview   # preview production build
```

There is no test suite in any subproject. There is no root-level build — the root only holds the NEIS scripts/workflow JSON and the three app directories.

For the Python/shell NEIS scripts, run directly (`python3 fetch_schools.py`, `./fetch_meals_paginated.sh`); both hit the live NEIS Open API and expect a real `KEY` (the shell script currently uses the placeholder `"sample"` key, which NEIS rate/size-limits).

## Conventions

- All three frontend apps use React 19 + Vite 7 with plain JS (`.jsx`, no TypeScript) and ESLint's flat config (`eslint.config.js`) per-project.
- `passid` and `data-hub` use `clsx` + `tailwind-merge` (see `cn()` helper in `passid/src/components/Editor.jsx`) for conditional class composition; `passid` additionally uses Tailwind v4 (`@tailwindcss/postcss`) for styling, while `data-hub` and `wfc-map-gen` use plain CSS files (`App.css`/`index.css`).
- `framer-motion` is the standard for transitions/animation across `data-hub` and `passid`; follow existing patterns (`AnimatePresence` with `initial`/`animate`/`exit`) rather than introducing a different animation library.

# Codédex September Project — Cozy eBook Library & Reader (Electron + React)

## Description

A cross‑platform desktop app to organize and read your eBooks locally. Import EPUBs, organize them into folders, and enjoy a distraction‑free, two‑page reading experience with themes, bookmarks, and progress tracking. The app includes duplicate detection, soft‑delete with undo, keyboard shortcuts, and gentle ambient visuals to make reading feel cozy.

Notable highlights:
- Two‑page spread reader with light/sepia/dark themes and adjustable typography
- Folder management (create, rename, delete) and quick move actions from context menus
- Search, filter (by status/folder), sort, and grid/list views
- Session tracking (time and pages) with a wellbeing reminder
- Smart EPUB pagination that avoids orphan headings and respects layout constraints

## What was used

- Languages & runtime
	- TypeScript, Node.js, HTML/CSS
- Core framework & tooling
	- Electron 30, React 18, Vite 5, Tailwind CSS 4
- UI & animation
	- lucide‑react, react‑transition‑group, framer‑motion
- Data & persistence
	- better‑sqlite3 (SQLite) for local library and sessions
- EPUB tooling (hybrid approach for robustness)
	- @smoores/epub, epub, epub2, epubjs, xml2js
	- archiving: adm‑zip, node‑stream‑zip, yauzl
- Platform integrations (optional)
	- discord‑rpc (rich presence)
	- ffi‑napi/ref‑napi (Windows media keys; optional native module)
- Build & packaging
	- vite‑plugin‑electron, electron‑builder

## How to run

Prereqs:
- Node.js 18+ (recommended) and npm

Install and start in development:

```pwsh
npm install
npm run dev
```

- A Vite dev server and the Electron app will start together. If the default port is in use, Vite will pick another.

Build a production package:

```pwsh
npm run build
```

- This runs TypeScript build, Vite build, and electron‑builder to produce a distributable.

## Project structure (high‑level)

- `electron/` — Main process, preload, platform helpers (e.g., Windows media keys)
- `dist-electron/` — Built main/preload outputs
- `src/` — React renderer
	- `components/` — UI: Books grid, reader, modals (book info, folders, settings, wellbeing, duplicates, etc.)
	- `contexts/` — App state (e.g., filter context)
	- `assets/` and `public/` — Icons, images, gifs

## Features (overview)

- Library
	- Import EPUBs via file picker with duplicate detection (by title/author, file, and Gutenberg ID)
	- Soft delete with an undo window
	- Grid/list layouts, sorting (title, author, recent, progress), and search
	- Folder management: create, rename, delete, and move books between folders
- Reader
	- Two‑page spread with page numbers; remembers your last position
	- Themes: light, sepia, dark; adjustable font size and line height
	- Bookmarks and chapter‑aware pagination
	- Live session stats (time and pages this session) and hydration reminder
- Extras
	- Optional Discord Rich Presence
	- Optional Windows media keys support (native; disabled if modules aren’t present)

## How it was made

- Architecture
	- Electron main process manages OS integration and a local SQLite database (via better‑sqlite3).
	- The preload script exposes a safe API on `window.db` for the renderer (getBooks, importEpub, addBook, getCoverData, updateBook, deleteBook, folder CRUD, reading sessions, and file dialogs).
	- The renderer is a React + Vite app with Tailwind styling and lazy‑loaded modals to keep the initial bundle lean.

- EPUB ingestion and metadata
	- A hybrid set of EPUB utilities is used to extract metadata and cover images more reliably across edge‑cases.
	- Duplicate prevention is enforced both in code and with SQLite unique indexes (file path; title/author pairs; optional Gutenberg IDs).

- Pagination & reading UX
	- Chapter HTML is measured in a hidden DOM container to split content into pages that respect computed styles.
	- Headings use a simple keep‑with‑next rule to avoid “lonely” headings at the bottom of a page.
	- Two‑page spreads use even page indices and clamp logic when jumping, so spreads stay aligned.

- Performance & polish
	- IntersectionObserver reveals book cards smoothly during scroll; motion is reduced when the user requests it.
	- Folder names are cached in the grid for quick display and refreshed after folder CRUD.
	- A soft‑delete queue provides a brief undo window before permanently removing items from the database.

## What went wrong (and how it was fixed)

- Resume counted all pages as “read this session”
	- On resume, the initial jump to the saved page was being added to the session page count. The session tracker now initializes the previous page to the resume position and only counts forward deltas after that.
- EPUB variance across books
	- Different EPUBs required mixing libraries and fallbacks for robust metadata/cover extraction.
- Pagination trade‑offs
	- Balancing accuracy and performance required measuring content with a hidden element and applying conservative split heuristics.
- Native modules on Windows
	- Optional media key support via ffi‑napi can fail without rebuild. It’s treated as optional and won’t break the app when absent.

## Future improvements

- Drag‑and‑drop import and background metadata fetching
- PDF/CBZ support alongside EPUB
- Tags in addition to folders; multi‑select and bulk actions
- Reading progress sync (e.g., cloud or local network)
- Smarter search (author/title tokens, fuzzy)
- Accessibility: improved keyboard navigation and screen‑reader passes
- Virtualized large grids/lists and cover caching strategies
- More tests (unit/e2e) for import, pagination, and session tracking

## What I learned

- Designing a reader means reconciling typographic fidelity with dynamic layouts.
- Preload bridges and SQLite make for a fast, simple local data model in desktop apps.
- Small UX details (undo toasts, progress feedback, reduced‑motion support) add up to a calmer experience.

## How I used GitHub Copilot

- Prompting to scaffold React components and hooks (e.g., modal shells, context menu patterns) which I then refined.
- Suggestions to tighten TypeScript types (especially around the `window.db` preload API) and safe narrowing.
- Quick Tailwind class suggestions for cohesive styling and micro‑animations.
- Bug‑fix guidance: shaping the session page‑counting logic on resume and the folder‑name refresh flow in the grid.
- Boilerplate hints for Vite + Electron wiring and SQLite unique‑index patterns to prevent duplicates.

## Troubleshooting

- On Windows, you may see Chromium disk cache warnings in development; they’re harmless.
- If you enable native modules (media keys), run a rebuild step after install (and match Electron/Node ABI). If you don’t need it, you can ignore those optional dependencies.

---

Happy reading! 📚


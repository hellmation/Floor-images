# UAE Code Championship — بطولة كود الإمارات

Collects the Federal Tax Authority's self-assessment against the UAE Code for Government Services and Zero Bureaucracy
(371 codes, 8 pillars), generates the Excel workbook, and shows readiness, compliance and analytics.

## Layout
- `data/` — bilingual master dataset extracted from the official PDF, project list, extraction scripts. See `data/README.md`.
- `app/` — the tool. Vite + React + TypeScript, Tailwind, ExcelJS. Builds to one self-contained HTML file.
- `release/UAE-Code-Championship.html` — the built single file to drop in the shared folder.

## Shared-folder edition (until the tool is hosted on the internal portal)
1. Copy `release/UAE-Code-Championship.html` into a shared folder every evaluator can reach.
2. Each evaluator opens the file in **Chrome or Edge**, clicks *Choose the shared folder* and picks that same folder (once; the browser remembers it and asks for a one-click reconnect on later visits).
3. The tool creates `data/` inside the folder:
   - `data/config.json` — users, projects, project-to-code mapping, cycles, settings (admins write it)
   - `data/answers/<user>.json` — one file per evaluator, written only by that evaluator
   - `data/reviews.json` — approvals, returns and clarification replies (admins write it)
   - `data/audit.json` — change log
4. Evaluators pick their name on the start screen. Roles come from `config.json` (admin / evaluator / viewer).
5. *Export Excel* in the header generates the workbook from everything in the folder.

Browsers without folder access (Firefox, Safari) fall back to a local mode with manual backup export/import; use Chrome or Edge for shared work.
When the tool moves to a server, only the storage adapter in `app/src/store/storage.ts` changes.

## How work flows
- Codes are assigned through projects: a code linked to a project is evaluated by the project owner; unmapped codes go to the core-team default assignee set in Admin → Settings. Admins can override any assignment per cycle.
- Everyone can read every code; only the assignee (or an admin) can edit it, and only while the cycle is open.
- Answers are per requirement: Yes / Partial / No / Not applicable, evidence links, note, project, optional service tag, and a *needs clarification* flag with a question that the admin answers from Review → Clarification requests.
- Submit is blocked until every requirement is answered, every Yes/Partial has evidence, every N/A has a justification, and no clarification flag is open.
- Review queue: approve (optionally confirming evidence was verified) or return with a comment. Only approved answers count in the official numbers; the dashboard can also show "everything answered".
- Scoring: Yes 100, Partial 50, No 0, N/A excluded; code score = average of its requirements; roll-ups weighted by impact (high 3, medium 2, low 1). All editable in Admin → Settings.
- Cycles: create the next quarter in Cycles with *Prefill from* the previous one; evaluators then see last cycle's answers pre-filled with a re-verify banner. The dashboard compares any two cycles.

## Development
```bash
cd app
npm install
npm run dev      # local dev server
npm run build    # writes app/dist/index.html (single file)
```

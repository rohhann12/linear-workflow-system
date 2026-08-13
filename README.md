# Jerry — Linear-triggered Claude Code cloud agent

Tag a Linear issue (or just say the word "jerry" in a comment) and it gets picked up, worked on by a small fleet of Claude Code agents, run for real in Docker, screenshotted with a real browser, and shipped as a PR — with a live chat UI showing status and logs as it happens.

**Live:** [ai.rohhann.space](https://ai.rohhann.space) (UI) · [api.rohhann.space](https://api.rohhann.space) (API/webhook)

## Workflow

<img width="1606" height="1474" alt="758E6F4B-2AB0-4400-86C9-154A99647564" src="https://github.com/user-attachments/assets/2ade30cd-ae6e-4809-a8d9-a919c23e73c9" />


Every session gets its own git worktree branched fresh off `main` (not off another session's unmerged work), so each PR's diff stays scoped to just that change. Worktrees share one persistent local clone, so spinning up a new session doesn't mean re-cloning over the network.

## Stack

- **Backend**: Node/Express — session queue, Linear webhook receiver (HMAC-verified), REST API, SSE log stream
- **Frontend**: React + Vite + Tailwind v4 + [shadcn/ui](https://ui.shadcn.com)
- **Agents**: headless Claude Code (`claude -p --output-format stream-json`), one per concern (setup / backend / frontend), run concurrently where safe
- **Verification**: real Docker Compose stack + Playwright screenshot of the running app, embedded directly in the PR

## Project structure

```
.
├── apps/
│   └── web/              # React + Vite + shadcn/ui chat UI
├── services/
│   └── orchestrator/     # Express backend — the actual workflow engine
│       ├── server.js     # webhook receiver, REST API, SSE stream, serves apps/web/dist
│       ├── sessions.js   # per-session queue (Linear issue or chat)
│       ├── pipeline.js   # git worktree → agents → docker → screenshot → PR
│       ├── agents.js     # spawns/streams headless Claude Code sub-agents
│       └── linear.js     # comments the resulting PR link back onto the issue
└── .github/workflows/    # CI: builds both workspaces on every push/PR
```

This is an npm workspaces monorepo — a single `npm install` at the root wires up both packages.

## Trigger

Any Linear comment (or the initial issue title/description) containing the word "jerry" starts a session — no bot user or assignee needed, just a plain Linear webhook (Settings → Administration → API → Webhooks) subscribed to Comments + Issues. The chat UI works identically and needs no Linear access at all.

## Setup

```bash
npm install
cp services/orchestrator/.env.example services/orchestrator/.env   # fill in LINEAR_API_KEY, LINEAR_WEBHOOK_SECRET, GITHUB_REPO_SSH
npm run build:web
npm start   # listens on :3333, serving apps/web/dist
```

Point your Linear webhook (or a local tunnel like ngrok during development) at `<your-url>/webhook/linear`.

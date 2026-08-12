const fs = require('fs');
const path = require('path');
const sessions = require('./sessions');
const { run } = require('./exec');
const { runClaudeAgent } = require('./agents');

const REPO_SSH = process.env.GITHUB_REPO_SSH || 'git@github.com:rohhann12/subsearch.git';
const REPO_SLUG = process.env.GITHUB_REPO || 'rohhann12/subsearch';
const WORKSPACE_ROOT = path.resolve(__dirname, process.env.WORKSPACE_DIR || '../workspace');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

const BASE_DIR = path.join(WORKSPACE_ROOT, '_base', 'subsearch');
const BASE_BRANCH = process.env.JERRY_BASE_BRANCH || 'jerry-base';

function repoDir(session) {
  return path.join(WORKSPACE_ROOT, session.id, 'subsearch');
}

// One persistent clone + a shared local `jerry-base` branch (forked from main)
// that every session worktree branches off. After a session pushes, jerry-base
// fast-forwards to include it, so later sessions inherit prior scaffolding
// (e.g. the ui/ app) instead of redoing it from a stale main every time.
async function ensureBaseRepo(session) {
  if (fs.existsSync(path.join(BASE_DIR, '.git'))) return;
  fs.mkdirSync(path.dirname(BASE_DIR), { recursive: true });
  await run(session, 'git', 'git', ['clone', REPO_SSH, BASE_DIR]);
  await run(session, 'git', 'git', ['checkout', '-b', BASE_BRANCH], { cwd: BASE_DIR });
}

async function ensureRepo(session) {
  const dir = repoDir(session);
  if (fs.existsSync(path.join(dir, '.git'))) {
    sessions.emit(session, 'log', { level: 'info', text: `[git] reusing existing worktree for this session` });
    return dir;
  }
  sessions.setStep(session, 'setup');
  await ensureBaseRepo(session);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  await run(session, 'git', 'git', ['worktree', 'add', '-b', session.branch, dir, BASE_BRANCH], { cwd: BASE_DIR });
  return dir;
}

async function waitForHealthy(session, url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (res.ok || res.status < 500) {
        sessions.emit(session, 'log', { level: 'info', text: `[health] ${url} is up (${res.status})` });
        return true;
      }
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  sessions.emit(session, 'log', { level: 'error', text: `[health] ${url} never became healthy` });
  return false;
}

async function takeScreenshot(session, dir) {
  const { chromium } = require('playwright');
  const shotDir = path.join(dir, '.jerry-screenshots');
  fs.mkdirSync(shotDir, { recursive: true });
  const filename = `${Date.now()}.png`;
  const filePath = path.join(shotDir, filename);
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.screenshot({ path: filePath });
    sessions.emit(session, 'log', { level: 'info', text: `[screenshot] saved ${filePath}` });
    return path.join('.jerry-screenshots', filename);
  } finally {
    await browser.close();
  }
}

function commitMessage(text) {
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > 72 ? firstLine.slice(0, 69) + '...' : firstLine;
}

async function commitAndPush(session, dir, message) {
  await run(session, 'git', 'git', ['add', '-A'], { cwd: dir });
  const status = await run(session, 'git', 'git', ['status', '--porcelain'], { cwd: dir });
  if (!status.stdout.trim()) {
    sessions.emit(session, 'log', { level: 'warn', text: '[git] nothing to commit' });
    return false;
  }
  await run(session, 'git', 'git', ['commit', '-m', commitMessage(message)], { cwd: dir });
  await run(session, 'git', 'git', ['push', '-u', 'origin', session.branch], { cwd: dir });

  // fast-forward the shared base branch so the next session's worktree starts
  // from this work instead of redoing it (e.g. re-scaffolding ui/ every time)
  await run(session, 'git', 'git', ['branch', '-f', BASE_BRANCH, session.branch], { cwd: BASE_DIR });
  return true;
}

async function openOrUpdatePr(session, dir, message, screenshotRelPath) {
  if (session.prUrl) {
    sessions.emit(session, 'log', { level: 'info', text: `[pr] already open: ${session.prUrl}` });
    return session.prUrl;
  }
  const body = screenshotRelPath
    ? [
        message,
        '',
        '### Preview',
        `![preview](https://raw.githubusercontent.com/${REPO_SLUG}/${session.branch}/${screenshotRelPath})`,
      ].join('\n')
    : message;
  const title = commitMessage(message);
  const result = await run(session, 'pr', 'gh', [
    'pr',
    'create',
    '--title',
    title,
    '--body',
    body,
    '--head',
    session.branch,
  ], { cwd: dir });
  const url = result.stdout.trim().split('\n').pop();
  session.prUrl = url && url.startsWith('http') ? url : null;

  if (session.prUrl) {
    sessions.emit(session, 'log', { level: 'info', text: `[pr] opened ${session.prUrl}` });
    return session.prUrl;
  }

  // gh pr create fails if a PR for this branch already exists (e.g. after an
  // orchestrator restart wiped in-memory session state) — recover by looking it up.
  const existing = await run(session, 'pr', 'gh', ['pr', 'view', session.branch, '--json', 'url'], { cwd: dir });
  try {
    const parsed = JSON.parse(existing.stdout);
    if (parsed.url) {
      session.prUrl = parsed.url;
      sessions.emit(session, 'log', { level: 'info', text: `[pr] found existing PR: ${session.prUrl}` });
      // the failed `pr create` never delivered this body/screenshot, so post it as a comment instead
      if (screenshotRelPath) {
        await commentScreenshot(session, dir, screenshotRelPath);
      }
    }
  } catch {
    // no existing PR either — genuinely failed to create one
  }
  return session.prUrl;
}

async function commentScreenshot(session, dir, screenshotRelPath) {
  const url = `https://raw.githubusercontent.com/${REPO_SLUG}/${session.branch}/${screenshotRelPath}`;
  await run(session, 'pr', 'gh', [
    'pr',
    'comment',
    session.prUrl,
    '--body',
    `### Preview (updated)\n![preview](${url})`,
  ], { cwd: dir });
}

async function runPipeline(session, message) {
  try {
    const dir = await ensureRepo(session);

    sessions.setStep(session, 'setup');
    const setup = await runClaudeAgent({
      session,
      label: 'setup',
      cwd: dir,
      prompt: `You're preparing this repo's workspace for a change. Task: "${message}". Install any new dependencies you can already tell are needed and make sure docker-compose config stays consistent. Do NOT implement the feature itself yet — that's handled by other agents next.`,
    });
    if (!setup.success) {
      sessions.emit(session, 'log', { level: 'warn', text: '[setup] agent reported an issue, continuing anyway' });
    }

    sessions.setStep(session, 'backend+frontend');
    const backendDir = path.join(dir, 'backend');
    const frontendDir = path.join(dir, 'ui');
    fs.mkdirSync(backendDir, { recursive: true });
    const frontendIsNew = !fs.existsSync(frontendDir);
    fs.mkdirSync(frontendDir, { recursive: true });

    const [backend, frontend] = await Promise.all([
      runClaudeAgent({
        session,
        label: 'backend',
        cwd: backendDir,
        prompt: `Implement the backend (Express/TypeScript) changes for: "${message}". Only touch files under this backend/ directory.`,
      }),
      runClaudeAgent({
        session,
        label: 'frontend',
        cwd: frontendDir,
        prompt: frontendIsNew
          ? `This ui/ directory is empty — the frontend doesn't exist yet even though docker-compose.yml expects to build it (Next.js app, port 3000, calls NEXT_PUBLIC_API_URL for the backend). Scaffold a minimal Next.js app here (with a Dockerfile matching how backend/Dockerfile is structured) AND implement: "${message}". Only touch files under this ui/ directory.`
          : `Implement the frontend (Next.js) changes for: "${message}". Only touch files under this ui/ directory.`,
      }),
    ]);

    sessions.setStep(session, 'build');
    await run(session, 'docker', 'docker-compose', ['up', '-d', '--build'], { cwd: dir });
    const healthy = await waitForHealthy(session, APP_URL);

    let screenshotRelPath = null;
    if (healthy) {
      sessions.setStep(session, 'screenshot');
      screenshotRelPath = await takeScreenshot(session, dir);
    }

    sessions.setStep(session, 'pr');
    const committed = await commitAndPush(session, dir, message);
    const hadPrBefore = !!session.prUrl;
    let prUrl = session.prUrl;
    if (committed && !screenshotRelPath) {
      sessions.emit(session, 'log', { level: 'warn', text: '[pr] no screenshot captured, opening PR without preview' });
    }
    if (committed || hadPrBefore) {
      prUrl = await openOrUpdatePr(session, dir, message, screenshotRelPath);
    }
    if (hadPrBefore && screenshotRelPath) {
      await commentScreenshot(session, dir, screenshotRelPath);
    }

    const summary = prUrl
      ? `Done — opened a PR: ${prUrl}`
      : backend.success || frontend.success
      ? 'Made changes but nothing was committed (no diff produced).'
      : 'Ran into trouble and could not complete the change.';
    sessions.addMessage(session, 'jerry', summary);
  } catch (err) {
    sessions.emit(session, 'log', { level: 'error', text: `[pipeline] crashed: ${err.message}` });
    sessions.addMessage(session, 'jerry', `Something went wrong: ${err.message}`);
  } finally {
    const next = sessions.finish(session);
    if (next) {
      runPipeline(session, next.text);
    }
  }
}

module.exports = { runPipeline };

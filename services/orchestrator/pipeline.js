const fs = require('fs');
const path = require('path');
const sessions = require('./sessions');
const { run } = require('./exec');
const { runClaudeAgent, generateTitle, classifyMessage } = require('./agents');
const { commentOnIssue, getIssueRef } = require('./linear');

const REPO_SSH = process.env.GITHUB_REPO_SSH || 'git@github.com:rohhann12/subsearch.git';
const REPO_SLUG = process.env.GITHUB_REPO || 'rohhann12/subsearch';
const WORKSPACE_ROOT = path.resolve(__dirname, process.env.WORKSPACE_DIR || '../../../workspace');
const APP_URL = process.env.APP_URL || 'http://localhost:3000';
const AUTH_FAILURE = /not logged in/i;

const BASE_DIR = path.join(WORKSPACE_ROOT, '_base', 'subsearch');

function repoDir(session) {
  return path.join(WORKSPACE_ROOT, session.id, 'subsearch');
}

// One persistent clone shared across sessions (avoids a full re-clone over
// SSH every time) — but every session's worktree always forks from the
// latest real `main`, never from another session's unmerged work, so each
// PR's diff stays scoped to just that session's change.
async function ensureBaseRepo(session) {
  if (!fs.existsSync(path.join(BASE_DIR, '.git'))) {
    fs.mkdirSync(path.dirname(BASE_DIR), { recursive: true });
    await run(session, 'git', 'git', ['clone', REPO_SSH, BASE_DIR]);
    return;
  }
  await run(session, 'git', 'git', ['checkout', 'main'], { cwd: BASE_DIR });
  await run(session, 'git', 'git', ['pull', '--ff-only', 'origin', 'main'], { cwd: BASE_DIR });
}

async function ensureRepo(session) {
  const dir = repoDir(session);
  if (fs.existsSync(path.join(dir, '.git'))) {
    sessions.emit(session, 'log', { level: 'info', text: `[git] reusing existing worktree for this session` });
    return dir;
  }
  await ensureBaseRepo(session);
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  await run(session, 'git', 'git', ['worktree', 'add', '-b', session.branch, dir, 'main'], { cwd: BASE_DIR });
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

async function commitAndPush(session, dir, message, title) {
  await run(session, 'git', 'git', ['add', '-A'], { cwd: dir });
  const status = await run(session, 'git', 'git', ['status', '--porcelain'], { cwd: dir });
  // A new screenshot alone isn't a real change worth a PR — only count it if
  // something outside .jerry-screenshots/ also changed.
  const realChanges = status.stdout.split('\n').filter((l) => l.trim() && !l.includes('.jerry-screenshots/'));
  if (realChanges.length === 0) {
    sessions.emit(session, 'log', { level: 'warn', text: '[git] nothing to commit (no real code changes)' });
    await run(session, 'git', 'git', ['reset', '--hard', 'HEAD'], { cwd: dir });
    return false;
  }
  await run(session, 'git', 'git', ['commit', '-m', title], { cwd: dir });
  await run(session, 'git', 'git', ['push', '-u', 'origin', session.branch], { cwd: dir });
  return true;
}

async function openOrUpdatePr(session, dir, message, screenshotRelPath, title) {
  if (session.prUrl) {
    sessions.emit(session, 'log', { level: 'info', text: `[pr] already open: ${session.prUrl}` });
    return session.prUrl;
  }
  const issueRef = await getIssueRef(session);
  const bodyParts = [message, ''];
  if (issueRef) bodyParts.push(`Linear: [${issueRef.identifier}](${issueRef.url})`, '');
  if (screenshotRelPath) {
    bodyParts.push(
      '### Preview',
      `![preview](https://raw.githubusercontent.com/${REPO_SLUG}/${session.branch}/${screenshotRelPath})`
    );
  }
  const body = bodyParts.join('\n');
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
    sessions.emit(session, 'log', { level: 'info', text: '[jerry] checking whether this needs any code changes…' });
    const intent = await classifyMessage(message);
    if (!intent.actionable) {
      sessions.addMessage(session, 'jerry', intent.reply || "Hey! Let me know what you'd like me to build.");
      return;
    }

    const dir = await ensureRepo(session);

    // Kicked off now so it resolves quietly in the background while setup/
    // backend/frontend/build run — by the time it's needed at the PR step,
    // minutes have usually passed instead of racing a tight timeout under load.
    const titlePromise = generateTitle(message, commitMessage(message));

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
    if (AUTH_FAILURE.test(setup.stderr || '')) {
      sessions.addMessage(
        session,
        'jerry',
        "Claude Code isn't authenticated on this machine right now, so I can't actually make changes. Someone needs to SSH in and run `claude` to log in again."
      );
      return;
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
    await run(session, 'docker', 'docker', ['compose', 'up', '-d', '--build'], { cwd: dir });
    const healthy = await waitForHealthy(session, APP_URL);

    let screenshotRelPath = null;
    if (healthy) {
      sessions.setStep(session, 'screenshot');
      screenshotRelPath = await takeScreenshot(session, dir);
    }

    sessions.setStep(session, 'pr');
    const title = await titlePromise;
    if (title === commitMessage(message)) {
      sessions.emit(session, 'log', { level: 'warn', text: '[pr] title generation fell back to raw message text' });
    }
    const committed = await commitAndPush(session, dir, message, title);
    const hadPrBefore = !!session.prUrl;
    let prUrl = session.prUrl;
    if (committed && !screenshotRelPath) {
      sessions.emit(session, 'log', { level: 'warn', text: '[pr] no screenshot captured, opening PR without preview' });
    }
    if (committed || hadPrBefore) {
      prUrl = await openOrUpdatePr(session, dir, message, screenshotRelPath, title);
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
    if (prUrl && !hadPrBefore) {
      await commentOnIssue(session, `Opened a PR: ${prUrl}${screenshotRelPath ? '' : '\n\n(no preview screenshot — the app never became healthy during this run)'}`);
    }
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

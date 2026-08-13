require('dotenv').config();
const crypto = require('crypto');
const path = require('path');
const express = require('express');
const chalk = require('chalk');
const sessions = require('./sessions');
const { runPipeline } = require('./pipeline');

const PORT = process.env.PORT || 3333;
const app = express();
app.set('trust proxy', true);

app.use(express.static(path.join(__dirname, '..', '..', 'apps', 'web', 'dist')));
app.use('/webhook', express.raw({ type: '*/*' }));
app.use(express.json());

function log(...args) {
  console.log(chalk.green(`[jerry]`), ...args);
}

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimitHits = new Map();

function rateLimited(req) {
  const ip = req.ip;
  const now = Date.now();
  const hits = (rateLimitHits.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  hits.push(now);
  rateLimitHits.set(ip, hits);
  return hits.length > RATE_LIMIT_MAX;
}

const MAX_MESSAGE_LENGTH = 4000;

app.get('/sessions', (req, res) => {
  res.json(sessions.listSessions());
});

app.get('/sessions/:id', (req, res) => {
  const session = sessions.getSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'not found' });
  res.json(sessions.serializeSession(session));
});

app.delete('/sessions/:id', (req, res) => {
  const ok = sessions.deleteSession(req.params.id);
  if (!ok) return res.status(409).json({ error: 'session is still running' });
  res.status(204).end();
});

app.get('/sessions/:id/stream', (req, res) => {
  const session = sessions.createSession(req.params.id, 'chat');

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.write(`data: ${JSON.stringify({ type: 'snapshot', session: sessions.serializeSession(session) })}\n\n`);

  const onEvent = (payload) => res.write(`data: ${JSON.stringify(payload)}\n\n`);
  session.emitter.on('event', onEvent);
  const heartbeat = setInterval(() => res.write(':\n\n'), 15000);

  req.on('close', () => {
    session.emitter.off('event', onEvent);
    clearInterval(heartbeat);
  });
});

app.post('/sessions/:id/messages', (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'text required' });
  if (text.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `text too long (max ${MAX_MESSAGE_LENGTH} chars)` });
  }
  if (rateLimited(req)) {
    return res.status(429).json({ error: 'too many requests, try again later' });
  }

  const session = sessions.createSession(req.params.id, 'chat');
  const result = sessions.submit(session, text.trim());
  log(`session ${session.id}: ${result.queued ? 'queued message' : 'starting pipeline'}`);

  if (!result.queued) {
    runPipeline(session, result.message.text);
  }
  res.json(sessions.serializeSession(session));
});

app.post('/webhook/linear', (req, res) => {
  const secret = process.env.LINEAR_WEBHOOK_SECRET;
  const signature = req.headers['linear-signature'];
  if (secret) {
    const expected = crypto.createHmac('sha256', secret).update(req.body).digest('hex');
    if (signature !== expected) {
      log(chalk.red('rejected webhook: bad signature'));
      return res.status(401).end();
    }
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    return res.status(400).end();
  }

  res.status(200).end();

  const TRIGGER = /\bjerry\b/i;
  const data = payload.data;
  let issueId = null;
  let text = null;

  if (payload.type === 'Comment' && payload.action === 'create' && TRIGGER.test(data?.body || '')) {
    issueId = data.issueId;
    text = data.body;
  } else if (
    payload.type === 'Issue' &&
    payload.action === 'create' &&
    TRIGGER.test(`${data?.title || ''} ${data?.description || ''}`)
  ) {
    issueId = data.id;
    text = [data.title, data.description].filter(Boolean).join('\n\n');
  }

  if (!issueId || !text) {
    log('webhook: not a Jerry-tagged comment/issue, ignoring');
    return;
  }

  const session = sessions.createSession(`linear-${issueId}`, 'linear', issueId);
  const result = sessions.submit(session, text);
  log(`linear issue ${issueId}: ${result.queued ? 'queued message' : 'starting pipeline'}`);
  if (!result.queued) {
    runPipeline(session, result.message.text);
  }
});

app.listen(PORT, () => {
  log(`orchestrator listening on http://localhost:${PORT}`);
});

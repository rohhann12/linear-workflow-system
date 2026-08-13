const { EventEmitter } = require('events');
const chalk = require('chalk');
const persistence = require('./persistence');

const LEVEL_COLOR = { info: chalk.green, warn: chalk.yellow, error: chalk.red };

const sessions = new Map();
let nextMessageId = 1;
const MAX_LOGS = 1000;

const loaded = persistence.loadAll().map((data) => {
  const session = {
    queue: [],
    transcript: [],
    logs: [],
    timeline: [],
    ...data,
    emitter: new EventEmitter(),
  };
  session.emitter.setMaxListeners(50);
  sessions.set(session.id, session);
  for (const msg of session.transcript) {
    if (msg.id >= nextMessageId) nextMessageId = msg.id + 1;
  }
  return session;
});

for (const session of loaded) {
  if (session.status !== 'running') continue;
  session.status = 'idle';
  session.currentStep = null;
  session.queue = [];
  addMessage(session, 'jerry', 'Interrupted by a server restart before this finished — send a message to retry.');
}

function createSession(id, source, linearIssueId) {
  if (sessions.has(id)) return sessions.get(id);
  const session = {
    id,
    source,
    linearIssueId: linearIssueId || null,
    status: 'idle',
    currentStep: null,
    queue: [],
    transcript: [],
    logs: [],
    timeline: [],
    branch: `jerry/${id}`,
    emitter: new EventEmitter(),
  };
  session.emitter.setMaxListeners(50);
  sessions.set(id, session);
  persistence.save(session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
}

function deleteSession(id) {
  const session = sessions.get(id);
  if (!session) return true;
  if (session.status === 'running') return false;
  sessions.delete(id);
  persistence.remove(id);
  return true;
}

function listSessions() {
  return Array.from(sessions.values()).map(serializeSession);
}

function serializeSession(session) {
  return {
    id: session.id,
    source: session.source,
    linearIssueId: session.linearIssueId,
    status: session.status,
    currentStep: session.currentStep,
    queuedCount: session.queue.length,
    transcript: session.transcript,
    logs: session.logs,
    timeline: session.timeline,
    branch: session.branch,
  };
}

function emit(session, type, data) {
  const payload = { type, ts: Date.now(), ...data };
  session.emitter.emit('event', payload);
  if (type === 'log') {
    session.logs.push(payload);
    if (session.logs.length > MAX_LOGS) session.logs.shift();
    const color = LEVEL_COLOR[data.level] || chalk.green;
    console.log(color(`[${session.id}] ${data.text}`));
  }
  persistence.save(session);
  return payload;
}

function addMessage(session, role, text) {
  const msg = { id: nextMessageId++, role, text, ts: Date.now() };
  session.transcript.push(msg);
  emit(session, 'message', { message: msg });
  return msg;
}

function submit(session, text) {
  const msg = addMessage(session, 'user', text);
  if (session.status === 'running') {
    session.queue.push(msg);
    const position = session.queue.length;
    emit(session, 'status', { status: 'running', queued: position });
    addMessage(
      session,
      'jerry',
      `Still working on the previous request — this one is queued (position ${position}). I'll pick it up right after.`
    );
    return { queued: true, position };
  }
  session.status = 'running';
  emit(session, 'status', { status: 'running', queued: 0 });
  return { queued: false, message: msg };
}

function startNext(session) {
  const next = session.queue.shift();
  session.status = 'running';
  emit(session, 'status', { status: 'running', queued: session.queue.length });
  return next;
}

function finish(session) {
  if (session.queue.length > 0) {
    return startNext(session);
  }
  session.status = 'idle';
  session.currentStep = null;
  emit(session, 'status', { status: 'idle', queued: 0 });
  return null;
}

function setStep(session, step) {
  session.currentStep = step;
  const entry = { step, ts: Date.now() };
  session.timeline.push(entry);
  emit(session, 'status', { status: 'running', step, queued: session.queue.length });
  session.emitter.emit('event', { type: 'timeline', ts: entry.ts, step });
  persistence.save(session);
}

module.exports = {
  sessions,
  createSession,
  getSession,
  listSessions,
  serializeSession,
  emit,
  addMessage,
  submit,
  startNext,
  finish,
  setStep,
};

const { EventEmitter } = require('events');
const chalk = require('chalk');

const LEVEL_COLOR = { info: chalk.green, warn: chalk.yellow, error: chalk.red };

// sessionId -> {
//   id, source ('chat'|'linear'), linearIssueId, status ('idle'|'running'),
//   currentStep, queue: [{id, text, createdAt}], transcript: [{role, text, ts}],
//   emitter, branch
// }
const sessions = new Map();
let nextMessageId = 1;

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
    branch: `jerry/${id}`,
    emitter: new EventEmitter(),
  };
  session.emitter.setMaxListeners(50);
  sessions.set(id, session);
  return session;
}

function getSession(id) {
  return sessions.get(id);
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
    branch: session.branch,
  };
}

function emit(session, type, data) {
  const payload = { type, ts: Date.now(), ...data };
  session.emitter.emit('event', payload);
  if (type === 'log') {
    const color = LEVEL_COLOR[data.level] || chalk.green;
    console.log(color(`[${session.id}] ${data.text}`));
  }
  return payload;
}

function addMessage(session, role, text) {
  const msg = { id: nextMessageId++, role, text, ts: Date.now() };
  session.transcript.push(msg);
  emit(session, 'message', { message: msg });
  return msg;
}

// Returns { queued: boolean, position } — enqueues if busy, otherwise leaves it
// to the caller to start the pipeline immediately.
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
  emit(session, 'status', { status: 'running', step, queued: session.queue.length });
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

let activeId = null;
let es = null;

function badgeHtml(session) {
  if (session.status === 'running') {
    return `<span class="badge running">running: ${session.currentStep || '...'}</span>` +
      (session.queuedCount ? `<span class="badge queued">${session.queuedCount} queued</span>` : '');
  }
  if (session.queuedCount) return `<span class="badge queued">${session.queuedCount} queued</span>`;
  return `<span class="badge idle">idle</span>`;
}

async function refreshSidebar() {
  const res = await fetch('/sessions');
  const list = await res.json();
  const el = document.getElementById('sessionList');
  el.innerHTML = '';
  list
    .sort((a, b) => b.id.localeCompare(a.id))
    .forEach((s) => {
      const item = document.createElement('div');
      item.className = 'session-item' + (s.id === activeId ? ' active' : '');
      item.innerHTML = `${s.id}${badgeHtml(s)}`;
      item.onclick = () => selectSession(s.id);
      el.appendChild(item);
    });
}

function renderMain(session) {
  document.getElementById('main').innerHTML = `
    <div id="header">
      <strong>${session.id}</strong> ${badgeHtml(session)}
    </div>
    <div id="transcript"></div>
    <div id="logPanel"></div>
    <div id="composeRow">
      <input id="composeInput" placeholder="Tell Jerry what to build..." />
      <button id="sendBtn">Send</button>
    </div>
  `;
  session.transcript.forEach(appendMessage);
  (session.logs || []).forEach(appendLog);
  document.getElementById('sendBtn').onclick = sendMessage;
  document.getElementById('composeInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function appendMessage(msg) {
  const el = document.createElement('div');
  el.className = `msg ${msg.role === 'user' ? 'user' : 'jerry'}`;
  el.textContent = msg.text;
  const transcript = document.getElementById('transcript');
  if (!transcript) return;
  transcript.appendChild(el);
  transcript.scrollTop = transcript.scrollHeight;
}

function appendLog(entry) {
  const panel = document.getElementById('logPanel');
  if (!panel) return;
  const line = document.createElement('div');
  line.className = `line ${entry.level || ''}`;
  line.textContent = entry.text;
  panel.appendChild(line);
  panel.scrollTop = panel.scrollHeight;
}

function updateHeaderBadge(session) {
  const header = document.getElementById('header');
  if (!header) return;
  header.innerHTML = `<strong>${session.id}</strong> ${badgeHtml(session)}`;
}

async function selectSession(id) {
  activeId = id;
  if (es) es.close();

  const res = await fetch(`/sessions/${id}`);
  const session = res.ok ? await res.json() : { id, status: 'idle', currentStep: null, queuedCount: 0, transcript: [] };
  renderMain(session);
  refreshSidebar();

  es = new EventSource(`/sessions/${id}/stream`);
  es.onmessage = (evt) => {
    const payload = JSON.parse(evt.data);
    if (payload.type === 'snapshot') {
      // header/transcript already rendered from initial fetch
    } else if (payload.type === 'message') {
      appendMessage(payload.message);
    } else if (payload.type === 'log') {
      appendLog(payload);
    } else if (payload.type === 'status') {
      updateHeaderBadge({ status: payload.status, currentStep: payload.step, queuedCount: payload.queued, id });
    }
    refreshSidebar();
  };
}

async function sendMessage() {
  const input = document.getElementById('composeInput');
  const text = input.value.trim();
  if (!text || !activeId) return;
  input.value = '';
  await fetch(`/sessions/${activeId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

document.getElementById('newSessionBtn').onclick = () => {
  const id = `chat-${Date.now()}`;
  selectSession(id);
};

async function loadLandingStats() {
  const res = await fetch('/sessions');
  const list = res.ok ? await res.json() : [];
  const prCount = list.reduce(
    (n, s) => n + s.transcript.filter((m) => m.role === 'jerry' && /opened a PR/i.test(m.text)).length,
    0
  );
  const running = list.filter((s) => s.status === 'running').length;
  document.getElementById('landingStats').innerHTML = `
    <div class="stat"><div class="n">${list.length}</div><div class="l">sessions</div></div>
    <div class="stat"><div class="n">${prCount}</div><div class="l">PRs opened</div></div>
    <div class="stat"><div class="n">${running}</div><div class="l">running now</div></div>
  `;
}

document.getElementById('enterBtn').onclick = () => {
  document.getElementById('landing').style.display = 'none';
  document.getElementById('app').classList.add('visible');
};

loadLandingStats();
refreshSidebar();
setInterval(refreshSidebar, 4000);

import type { Session } from './types';

export interface Milestone {
  key: string;
  ts: number;
  icon: string;
  text: string;
  link?: string;
}

export interface NarrationNote {
  key: string;
  ts: number;
  text: string;
}

const STEP_LABEL: Record<string, { icon: string; text: string }> = {
  setup: { icon: '🔍', text: 'Evaluating the request & preparing the workspace' },
  'backend+frontend': { icon: '🛠️', text: 'Writing the code' },
  build: { icon: '🐳', text: 'Building & starting the app' },
  screenshot: { icon: '📸', text: 'Capturing a screenshot' },
  pr: { icon: '🔀', text: 'Opening the pull request' },
};

const FILE_CHANGE = /^\[(\w[\w+-]*)\] → (Edit|Write) (\S+)/;
const NARRATION = /^\[(setup|backend|frontend)\] (?!→)(.+)/;
const PR_OPENED = /opened a PR: (\S+)/i;
const TROUBLE = /(ran into trouble|something went wrong)/i;
const SKIP_NARRATION = /^(starting…|starting\.\.\.)$/i;

function shortenPath(path: string) {
  const marker = path.indexOf('/subsearch/');
  return marker >= 0 ? path.slice(marker + '/subsearch/'.length) : path.split('/').pop() ?? path;
}

// The step/file/PR/error markers — a compact, high-level progress stepper.
export function deriveMilestones(session: Pick<Session, 'timeline' | 'logs' | 'transcript'>): Milestone[] {
  const items: Milestone[] = [];
  const seenFiles = new Set<string>();

  for (const entry of session.timeline) {
    const label = STEP_LABEL[entry.step];
    if (!label) continue;
    items.push({ key: `step-${entry.ts}`, ts: entry.ts, icon: label.icon, text: label.text });
  }

  for (const log of session.logs) {
    const fileMatch = FILE_CHANGE.exec(log.text);
    if (!fileMatch) continue;
    const file = shortenPath(fileMatch[3]);
    const key = `${fileMatch[2]}:${file}`;
    if (seenFiles.has(key)) continue;
    seenFiles.add(key);
    items.push({
      key: `file-${log.ts}-${file}`,
      ts: log.ts,
      icon: fileMatch[2] === 'Write' ? '📄' : '✏️',
      text: `${fileMatch[2] === 'Write' ? 'Created' : 'Changed'} ${file}`,
    });
  }

  for (const msg of session.transcript) {
    if (msg.role !== 'jerry') continue;
    const pr = PR_OPENED.exec(msg.text);
    if (pr) {
      items.push({ key: `pr-${msg.id}`, ts: msg.ts, icon: '✅', text: 'Pull request opened', link: pr[1] });
      continue;
    }
    if (TROUBLE.test(msg.text)) {
      items.push({ key: `err-${msg.id}`, ts: msg.ts, icon: '⚠️', text: msg.text });
    }
  }

  return items.sort((a, b) => a.ts - b.ts);
}

// The agent's own running commentary — meant to be dropped into the chat
// panel as lightweight Jerry bubbles so it reads like it's actually talking
// to you, not like a separate activity log.
export function deriveNarration(session: Pick<Session, 'logs'>): NarrationNote[] {
  const notes: NarrationNote[] = [];
  for (const log of session.logs) {
    const match = NARRATION.exec(log.text);
    if (!match || SKIP_NARRATION.test(match[2].trim())) continue;
    notes.push({ key: `note-${log.ts}-${notes.length}`, ts: log.ts, text: match[2] });
  }
  return notes;
}

import type { Session } from './types';

export interface ActivityItem {
  key: string;
  ts: number;
  icon: string;
  text: string;
  link?: string;
}

const STEP_LABEL: Record<string, { icon: string; text: string }> = {
  setup: { icon: '🔍', text: 'Evaluating the request & preparing the workspace' },
  'backend+frontend': { icon: '🛠️', text: 'Writing the code' },
  build: { icon: '🐳', text: 'Building & starting the app' },
  screenshot: { icon: '📸', text: 'Capturing a screenshot' },
  pr: { icon: '🔀', text: 'Opening the pull request' },
};

const FILE_CHANGE = /^\[(\w[\w+-]*)\] → (Edit|Write) (\S+)/;
const PR_OPENED = /opened a PR: (\S+)/i;
const TROUBLE = /(ran into trouble|something went wrong)/i;

function shortenPath(path: string) {
  const marker = path.indexOf('/subsearch/');
  return marker >= 0 ? path.slice(marker + '/subsearch/'.length) : path.split('/').pop() ?? path;
}

export function deriveActivity(session: Pick<Session, 'timeline' | 'logs' | 'transcript'>): ActivityItem[] {
  const items: ActivityItem[] = [];
  const seenFiles = new Set<string>();

  for (const entry of session.timeline) {
    const label = STEP_LABEL[entry.step];
    if (!label) continue;
    items.push({ key: `step-${entry.ts}`, ts: entry.ts, icon: label.icon, text: label.text });
  }

  for (const log of session.logs) {
    const match = FILE_CHANGE.exec(log.text);
    if (!match) continue;
    const file = shortenPath(match[3]);
    const key = `${match[2]}:${file}`;
    if (seenFiles.has(key)) continue;
    seenFiles.add(key);
    items.push({
      key: `file-${log.ts}-${file}`,
      ts: log.ts,
      icon: match[2] === 'Write' ? '📄' : '✏️',
      text: `${match[2] === 'Write' ? 'Created' : 'Changed'} ${file}`,
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

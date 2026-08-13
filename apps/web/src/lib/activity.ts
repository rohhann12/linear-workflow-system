import type { Session } from './types';

export interface NarrationNote {
  key: string;
  ts: number;
  text: string;
}

const NARRATION = /^\[(setup|backend|frontend)\] (?!→)(.+)/;
const SKIP_NARRATION = /^(starting…|starting\.\.\.)$/i;

export function deriveNarration(session: Pick<Session, 'logs'>): NarrationNote[] {
  const notes: NarrationNote[] = [];
  for (const log of session.logs) {
    const match = NARRATION.exec(log.text);
    if (!match || SKIP_NARRATION.test(match[2].trim())) continue;
    notes.push({ key: `note-${log.ts}-${notes.length}`, ts: log.ts, text: match[2] });
  }
  return notes;
}

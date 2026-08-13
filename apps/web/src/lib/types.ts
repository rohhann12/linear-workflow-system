export type MessageRole = 'user' | 'jerry';

export interface Message {
  id: number;
  role: MessageRole;
  text: string;
  ts: number;
}

export interface LogEntry {
  type: 'log';
  ts: number;
  level: 'info' | 'warn' | 'error';
  text: string;
}

export interface TimelineEntry {
  step: string;
  ts: number;
}

export interface Session {
  id: string;
  source: 'chat' | 'linear';
  linearIssueId: string | null;
  status: 'idle' | 'running';
  currentStep: string | null;
  queuedCount: number;
  transcript: Message[];
  logs: LogEntry[];
  timeline: TimelineEntry[];
  branch: string;
}

export type StreamEvent =
  | { type: 'snapshot'; session: Session }
  | { type: 'message'; message: Message }
  | (LogEntry)
  | { type: 'status'; status: 'idle' | 'running'; step?: string; queued: number }
  | { type: 'timeline'; ts: number; step: string };

import type { Session } from './types';

export async function listSessions(): Promise<Session[]> {
  const res = await fetch('/sessions');
  return res.ok ? res.json() : [];
}

export async function getSession(id: string): Promise<Session | null> {
  const res = await fetch(`/sessions/${id}`);
  return res.ok ? res.json() : null;
}

export async function sendMessage(id: string, text: string): Promise<Session> {
  const res = await fetch(`/sessions/${id}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function deleteSession(id: string): Promise<boolean> {
  const res = await fetch(`/sessions/${id}`, { method: 'DELETE' });
  return res.ok;
}

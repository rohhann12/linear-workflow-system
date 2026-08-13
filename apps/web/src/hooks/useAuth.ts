import { useEffect, useState } from 'react';

export type AuthStatus = 'checking' | 'authed' | 'unauthed';

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>('checking');

  useEffect(() => {
    fetch('/auth/status')
      .then((r) => r.json())
      .then((d) => setStatus(d.authed ? 'authed' : 'unauthed'))
      .catch(() => setStatus('unauthed'));
  }, []);

  async function login(password: string): Promise<boolean> {
    const res = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setStatus('authed');
      return true;
    }
    return false;
  }

  return { status, login };
}

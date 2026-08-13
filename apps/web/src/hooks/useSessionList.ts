import { useEffect, useState } from 'react';
import { listSessions } from '@/lib/api';
import type { Session } from '@/lib/types';

export function useSessionList(enabled = true, intervalMs = 4000) {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const refresh = () => listSessions().then((s) => !cancelled && setSessions(s));
    refresh();
    const id = setInterval(refresh, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled, intervalMs]);

  return sessions;
}

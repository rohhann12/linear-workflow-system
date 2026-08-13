import { useEffect, useRef, useState } from 'react';
import { getSession } from '@/lib/api';
import type { Session } from '@/lib/types';

const EMPTY_SESSION = (id: string): Session => ({
  id,
  source: 'chat',
  linearIssueId: null,
  status: 'idle',
  currentStep: null,
  queuedCount: 0,
  transcript: [],
  logs: [],
  timeline: [],
  branch: '',
});

export function useSessionStream(id: string | null) {
  const [session, setSession] = useState<Session | null>(null);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!id) {
      setSession(null);
      return;
    }

    let cancelled = false;
    setSession(null);

    getSession(id).then((s) => {
      if (!cancelled) setSession(s ?? EMPTY_SESSION(id));
    });

    const es = new EventSource(`/sessions/${id}/stream`);
    esRef.current = es;

    es.onmessage = (evt) => {
      const payload = JSON.parse(evt.data);
      setSession((prev) => {
        const base = prev ?? EMPTY_SESSION(id);
        if (payload.type === 'message') {
          return { ...base, transcript: [...base.transcript, payload.message] };
        }
        if (payload.type === 'log') {
          return { ...base, logs: [...base.logs, payload] };
        }
        if (payload.type === 'timeline') {
          return { ...base, timeline: [...base.timeline, { step: payload.step, ts: payload.ts }] };
        }
        if (payload.type === 'status') {
          return {
            ...base,
            status: payload.status,
            currentStep: payload.step ?? (payload.status === 'idle' ? null : base.currentStep),
            queuedCount: payload.queued ?? 0,
          };
        }
        return base;
      });
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [id]);

  return session;
}

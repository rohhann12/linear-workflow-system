import { useEffect, useRef } from 'react';
import type { LogEntry } from '@/lib/types';
import { cn } from '@/lib/utils';

const LEVEL_CLASS: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-emerald-400',
};

export function Terminal({ logs, open, onClose }: { logs: LogEntry[]; open: boolean; onClose: () => void }) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: 'end' });
  }, [logs.length, open]);

  return (
    <div
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 h-1/2 border-t bg-black shadow-2xl transition-transform duration-200',
        open ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2 text-xs text-white/60">
        <span>Terminal — raw log output</span>
        <button onClick={onClose} className="hover:text-white">
          close (⌘J)
        </button>
      </div>
      <div className="h-[calc(100%-2.25rem)] overflow-y-auto p-3 font-mono text-xs">
        {logs.map((log, i) => (
          <div key={i} className={cn('whitespace-pre-wrap break-all', LEVEL_CLASS[log.level] ?? 'text-emerald-400')}>
            {log.text}
          </div>
        ))}
        <div ref={endRef} />
      </div>
    </div>
  );
}

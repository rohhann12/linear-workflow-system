import { useEffect, useMemo, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from './StatusBadge';
import { Terminal } from './Terminal';
import { useTerminalToggle } from '@/hooks/useTerminalToggle';
import { sendMessage, deleteSession } from '@/lib/api';
import { deriveNarration } from '@/lib/activity';
import type { Session } from '@/lib/types';
import { cn } from '@/lib/utils';

type ChatBubble =
  | { key: string; ts: number; role: 'user' | 'jerry'; text: string; kind: 'message' }
  | { key: string; ts: number; role: 'jerry'; text: string; kind: 'narration' };

export function ChatView({ session, onDeleted }: { session: Session; onDeleted: () => void }) {
  const [input, setInput] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const terminal = useTerminalToggle();

  const bubbles = useMemo<ChatBubble[]>(() => {
    const messages: ChatBubble[] = session.transcript.map((m) => ({
      key: `msg-${m.id}`,
      ts: m.ts,
      role: m.role,
      text: m.text,
      kind: 'message',
    }));
    const narration: ChatBubble[] = deriveNarration(session).map((n) => ({
      key: n.key,
      ts: n.ts,
      role: 'jerry',
      text: n.text,
      kind: 'narration',
    }));
    return [...messages, ...narration].sort((a, b) => a.ts - b.ts);
  }, [session.transcript, session.logs]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [bubbles.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(session.id, text);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete session "${session.id}"? This can't be undone.`)) return;
    const ok = await deleteSession(session.id);
    if (ok) onDeleted();
    else window.alert("Can't delete — this session is still running.");
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{session.id}</span>
          <StatusBadge session={session} />
        </div>
        <div className="flex items-center gap-3">
          {session.status === 'running' && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
              </span>
              Still working…
            </div>
          )}
          <button
            onClick={() => terminal.setOpen((o) => !o)}
            className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
          >
            Press {terminal.hint} for terminal
          </button>
          <button
            onClick={handleDelete}
            disabled={session.status === 'running'}
            className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
          >
            Delete
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-2 p-5">
            {bubbles.map((b) => {
              const isNarration = b.kind === 'narration';
              return (
                <div
                  key={b.key}
                  className={cn(
                    'flex items-end gap-2',
                    b.role === 'user' ? 'flex-row-reverse self-end' : 'self-start'
                  )}
                >
                  {!isNarration && (
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-xs">{b.role === 'user' ? 'U' : '🐺'}</AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={cn(
                      'max-w-md rounded-2xl leading-relaxed',
                      isNarration
                        ? 'ml-9 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50'
                        : 'px-3.5 py-2 text-sm',
                      !isNarration && b.role === 'user' && 'bg-primary text-primary-foreground',
                      !isNarration && b.role === 'jerry' && 'bg-card border shadow-sm'
                    )}
                  >
                    {b.text}
                  </div>
                </div>
              );
            })}
            <div ref={transcriptEndRef} />
          </div>
        </ScrollArea>
      </div>

      <div className="flex gap-2 border-t p-3">
        <Input
          placeholder="Tell Jerry what to build..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>

      <Terminal logs={session.logs} open={terminal.open} onClose={() => terminal.setOpen(false)} />
    </div>
  );
}

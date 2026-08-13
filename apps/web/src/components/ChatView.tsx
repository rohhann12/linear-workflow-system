import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from './StatusBadge';
import { ActivityFeed } from './ActivityFeed';
import { Terminal } from './Terminal';
import { useTerminalToggle } from '@/hooks/useTerminalToggle';
import { sendMessage } from '@/lib/api';
import type { Session } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ChatView({ session }: { session: Session }) {
  const [input, setInput] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const terminal = useTerminalToggle();

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [session.transcript.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(session.id, text);
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b px-5 py-3.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-medium">{session.id}</span>
          <StatusBadge session={session} />
        </div>
        <button
          onClick={() => terminal.setOpen((o) => !o)}
          className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted"
        >
          Press {terminal.hint} for terminal
        </button>
      </div>

      <div className="flex min-h-0 flex-1">
        <ActivityFeed session={session} />

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex flex-col gap-3 p-5">
            {session.transcript.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'flex items-end gap-2',
                  msg.role === 'user' ? 'flex-row-reverse self-end' : 'self-start'
                )}
              >
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="text-xs">{msg.role === 'user' ? 'U' : '🐺'}</AvatarFallback>
                </Avatar>
                <div
                  className={cn(
                    'max-w-md rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                    msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
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

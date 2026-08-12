import { useEffect, useRef, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { StatusBadge } from './StatusBadge';
import { sendMessage } from '@/lib/api';
import type { Session } from '@/lib/types';
import { cn } from '@/lib/utils';

const LEVEL_CLASS: Record<string, string> = {
  error: 'text-red-400',
  warn: 'text-amber-400',
  info: 'text-emerald-400',
};

export function ChatView({ session }: { session: Session }) {
  const [input, setInput] = useState('');
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ block: 'end' });
  }, [session.transcript.length]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [session.logs.length]);

  async function handleSend() {
    const text = input.trim();
    if (!text) return;
    setInput('');
    await sendMessage(session.id, text);
  }

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex items-center gap-3 border-b px-5 py-3.5">
        <span className="font-mono text-sm font-medium">{session.id}</span>
        <StatusBadge session={session} />
      </div>

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-3 p-5">
          {session.transcript.map((msg) => (
            <div
              key={msg.id}
              className={cn('flex items-end gap-2', msg.role === 'user' ? 'flex-row-reverse self-end' : 'self-start')}
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

      <ScrollArea className="h-48 border-t bg-black">
        <div className="p-3 font-mono text-xs">
          {session.logs.map((log, i) => (
            <div key={i} className={cn('whitespace-pre-wrap break-all', LEVEL_CLASS[log.level] ?? 'text-emerald-400')}>
              {log.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </ScrollArea>

      <div className="flex gap-2 border-t p-3">
        <Input
          placeholder="Tell Jerry what to build..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <Button onClick={handleSend}>Send</Button>
      </div>
    </div>
  );
}

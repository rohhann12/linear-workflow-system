import { useEffect, useMemo, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { deriveActivity } from '@/lib/activity';
import type { Session } from '@/lib/types';
import { cn } from '@/lib/utils';

export function ActivityFeed({ session }: { session: Session }) {
  const items = useMemo(() => deriveActivity(session), [session.timeline, session.logs, session.transcript]);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [items.length]);

  return (
    <div className="flex h-full min-h-0 w-80 shrink-0 flex-col border-r">
      <div className="border-b px-4 py-3.5 text-sm font-medium text-muted-foreground">Activity</div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-4">
          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">Nothing yet — send a message to get started.</p>
          )}
          {items.map((item) => {
            const isDetail = item.variant === 'detail';
            return (
              <div
                key={item.key}
                className={cn('flex items-start gap-2', isDetail ? 'pl-4 text-xs' : 'text-sm')}
              >
                <span className={cn('leading-none', isDetail ? 'text-xs' : 'text-base')}>{item.icon}</span>
                <div className="min-w-0 flex-1">
                  {item.link ? (
                    <a
                      href={item.link}
                      target="_blank"
                      rel="noreferrer"
                      className="break-words font-medium text-primary underline underline-offset-2"
                    >
                      {item.text}
                    </a>
                  ) : (
                    <span
                      className={cn(
                        'break-words leading-snug',
                        isDetail ? 'text-muted-foreground' : 'font-medium'
                      )}
                    >
                      {item.text}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </ScrollArea>
    </div>
  );
}

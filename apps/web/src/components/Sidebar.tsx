import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { StatusBadge } from './StatusBadge';
import type { Session } from '@/lib/types';
import { cn } from '@/lib/utils';

export function Sidebar({
  sessions,
  activeId,
  onSelect,
  onNewSession,
}: {
  sessions: Session[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewSession: () => void;
}) {
  const sorted = [...sessions].sort((a, b) => b.id.localeCompare(a.id));

  return (
    <div className="flex h-full min-h-0 w-72 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-3.5">
        <span className="text-2xl">🐺</span>
        <span className="font-semibold">Jerry</span>
      </div>
      <Separator />
      <div className="p-3">
        <Button className="w-full" onClick={onNewSession}>
          + New session
        </Button>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-1 px-2 pb-2">
          {sorted.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className={cn(
                'flex flex-col gap-1 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-sidebar-accent',
                s.id === activeId && 'bg-sidebar-accent'
              )}
            >
              <span className="truncate font-mono text-xs">{s.id}</span>
              <StatusBadge session={s} />
            </button>
          ))}
          {sorted.length === 0 && (
            <p className="px-3 py-2 text-xs text-muted-foreground">No sessions yet.</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

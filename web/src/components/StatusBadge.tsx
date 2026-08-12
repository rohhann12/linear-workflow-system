import { Badge } from '@/components/ui/badge';
import type { Session } from '@/lib/types';

export function StatusBadge({ session }: { session: Pick<Session, 'status' | 'currentStep' | 'queuedCount'> }) {
  if (session.status === 'running') {
    return (
      <div className="flex items-center gap-1.5">
        <Badge className="bg-blue-600 text-white hover:bg-blue-600">
          running{session.currentStep ? `: ${session.currentStep}` : ''}
        </Badge>
        {session.queuedCount > 0 && (
          <Badge className="bg-amber-600 text-white hover:bg-amber-600">{session.queuedCount} queued</Badge>
        )}
      </div>
    );
  }
  if (session.queuedCount > 0) {
    return <Badge className="bg-amber-600 text-white hover:bg-amber-600">{session.queuedCount} queued</Badge>;
  }
  return (
    <Badge variant="secondary" className="text-muted-foreground">
      idle
    </Badge>
  );
}

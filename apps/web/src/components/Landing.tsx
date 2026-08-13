import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import type { Session } from '@/lib/types';

export function Landing({ sessions, onEnter }: { sessions: Session[]; onEnter: () => void }) {
  const prCount = sessions.reduce(
    (n, s) => n + s.transcript.filter((m) => m.role === 'jerry' && /opened a PR/i.test(m.text)).length,
    0
  );
  const running = sessions.filter((s) => s.status === 'running').length;

  const stats = [
    { n: sessions.length, l: 'sessions' },
    { n: prCount, l: 'PRs opened' },
    { n: running, l: 'running now' },
  ];

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <span className="text-6xl">🐺</span>
      <h1 className="text-3xl font-bold tracking-tight">Welcome to Jerry's work</h1>
      <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
        Tag Jerry on a Linear ticket, or start a chat below, and it clones the repo, writes the code, runs it for
        real, and opens a PR — screenshot included.
      </p>
      <div className="flex gap-6">
        {stats.map((s) => (
          <Card key={s.l} className="w-28 py-4">
            <CardContent className="flex flex-col items-center gap-1 px-2">
              <span className="text-2xl font-bold">{s.n}</span>
              <span className="text-xs text-muted-foreground">{s.l}</span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button size="lg" onClick={onEnter}>
        Enter →
      </Button>
    </div>
  );
}

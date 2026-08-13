import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import type { Session } from '@/lib/types';

const FEATURES = [
  { icon: '🔍', label: 'Clones the repo' },
  { icon: '🛠️', label: 'Writes real code' },
  { icon: '🐳', label: 'Builds & verifies' },
  { icon: '🔀', label: 'Opens a PR' },
];

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
    <div className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6">
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[440px] w-[440px] rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 flex max-w-lg flex-col items-center gap-7 text-center">
        <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Live agent
        </Badge>

        <span className="text-6xl drop-shadow-sm">🐺</span>

        <div className="space-y-2.5">
          <h1 className="text-4xl font-bold tracking-tight">Welcome to Jerry's work</h1>
          <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
            Tag Jerry on a Linear ticket, or start a chat below, and it clones the repo, writes the code, runs it
            for real, and opens a PR — screenshot included.
          </p>
        </div>

        <div className="flex gap-3">
          {stats.map((s) => (
            <Card key={s.l} className="w-28 border-none bg-card/80 py-4 shadow-sm backdrop-blur-sm">
              <CardContent className="flex flex-col items-center gap-1 px-2">
                <span className="text-2xl font-bold tabular-nums">{s.n}</span>
                <span className="text-xs text-muted-foreground">{s.l}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button size="lg" onClick={onEnter} className="gap-2 px-6 shadow-sm">
          Enter
          <ArrowRight className="size-4" />
        </Button>

        <Separator className="w-full max-w-xs" />

        <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-left sm:grid-cols-4 sm:gap-x-6">
          {FEATURES.map((f) => (
            <div key={f.label} className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-base leading-none">{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

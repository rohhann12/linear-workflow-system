import { ArrowRight, ExternalLink, ScanSearch, Wrench, Boxes, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Session } from '@/lib/types';

const FEATURES = [
  { icon: ScanSearch, title: 'Clones the repo', desc: 'Forks a fresh worktree off main for every session.' },
  { icon: Wrench, title: 'Writes real code', desc: 'Parallel agents split backend and frontend work.' },
  { icon: Boxes, title: 'Builds & verifies', desc: 'Real Docker Compose stack, health-checked live.' },
  { icon: GitBranch, title: 'Opens a PR', desc: 'Screenshot embedded, ready for review.' },
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-[#07070a] text-zinc-50">
      <div className="pointer-events-none absolute inset-0">
        <div className="animate-blob-slow absolute -left-32 -top-40 h-[520px] w-[520px] rounded-full bg-violet-600/30 blur-[120px]" />
        <div className="animate-blob-slower absolute -right-40 top-1/3 h-[480px] w-[480px] rounded-full bg-sky-500/20 blur-[120px]" />
        <div className="animate-blob-slow absolute bottom-[-160px] left-1/3 h-[420px] w-[420px] rounded-full bg-emerald-400/20 blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,#07070a_72%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:56px_56px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-300">
          <span className="text-lg leading-none">🐺</span> Jerry
        </div>
        <a
          href="https://github.com/rohhann12/subsearch"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur transition hover:bg-white/10 hover:text-white"
        >
          <ExternalLink className="size-3.5" />
          GitHub
        </a>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <div className="mb-6 flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-zinc-300 backdrop-blur">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          {running > 0 ? `${running} session${running === 1 ? '' : 's'} running now` : 'Live agent, ready to ship'}
        </div>

        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
          Tag a ticket.
          <br />
          <span className="bg-gradient-to-r from-violet-400 via-sky-400 to-emerald-400 bg-clip-text text-transparent">
            Wake up to a PR.
          </span>
        </h1>
        <p className="mx-auto mt-5 max-w-lg text-balance text-sm leading-relaxed text-zinc-400 sm:text-base">
          Mention Jerry on a Linear ticket, or just start chatting — it clones the repo, writes the code across
          parallel agents, runs the app for real in Docker, and opens a pull request with a live screenshot.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Button
            size="lg"
            onClick={onEnter}
            className="gap-2 rounded-full bg-white px-6 text-zinc-900 shadow-[0_0_0_1px_rgba(255,255,255,0.1),0_8px_30px_-4px_rgba(255,255,255,0.4)] hover:bg-zinc-100"
          >
            Enter workspace
            <ArrowRight className="size-4" />
          </Button>
        </div>

        <div className="mt-12 flex gap-3">
          {stats.map((s) => (
            <div
              key={s.l}
              className="w-28 rounded-2xl border border-white/10 bg-white/[0.04] py-4 backdrop-blur-sm"
            >
              <div className="text-2xl font-semibold tabular-nums">{s.n}</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">{s.l}</div>
            </div>
          ))}
        </div>
      </main>

      <footer className="relative z-10 border-t border-white/5 px-6 py-8">
        <div className="mx-auto grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="group rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.06]"
            >
              <f.icon className="size-4 text-zinc-400 transition group-hover:text-zinc-100" />
              <div className="mt-2.5 text-xs font-medium text-zinc-200">{f.title}</div>
              <div className="mt-1 text-[11px] leading-snug text-zinc-500">{f.desc}</div>
            </div>
          ))}
        </div>
      </footer>
    </div>
  );
}

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';

export function PasswordGate({ onSubmit }: { onSubmit: (password: string) => Promise<boolean> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    if (!password.trim()) return;
    setBusy(true);
    setError(false);
    const ok = await onSubmit(password.trim());
    setBusy(false);
    if (!ok) setError(true);
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background px-6">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-4 pt-2 text-center">
          <span className="text-4xl">🐺</span>
          <h1 className="text-lg font-semibold">This is a private preview</h1>
          <p className="text-sm text-muted-foreground">Enter the access password to continue.</p>
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            autoFocus
            className="text-center"
          />
          {error && <p className="text-xs text-destructive">Wrong password — try again.</p>}
          <Button className="w-full" onClick={handleSubmit} disabled={busy}>
            {busy ? 'Checking…' : 'Enter'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

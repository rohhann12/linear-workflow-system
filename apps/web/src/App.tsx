import { useEffect, useState } from 'react';
import { Landing } from '@/components/Landing';
import { Sidebar } from '@/components/Sidebar';
import { ChatView } from '@/components/ChatView';
import { PasswordGate } from '@/components/PasswordGate';
import { useAuth } from '@/hooks/useAuth';
import { useSessionList } from '@/hooks/useSessionList';
import { useSessionStream } from '@/hooks/useSessionStream';

function getInitialSessionId(): string | null {
  return new URL(window.location.href).searchParams.get('session');
}

export default function App() {
  const auth = useAuth();
  const initial = getInitialSessionId();
  const [entered, setEntered] = useState(!!initial);
  const [activeId, setActiveId] = useState<string | null>(initial);

  const authed = auth.status === 'authed';
  const sessions = useSessionList(authed);
  const activeSession = useSessionStream(authed ? activeId : null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeId) url.searchParams.set('session', activeId);
    else url.searchParams.delete('session');
    window.history.replaceState(null, '', url);
  }, [activeId]);

  function handleNewSession() {
    setActiveId(`chat-${Date.now()}`);
    setEntered(true);
  }

  if (auth.status === 'checking') return null;
  if (auth.status === 'unauthed') return <PasswordGate onSubmit={auth.login} />;

  if (!entered) {
    return <Landing sessions={sessions} onEnter={() => setEntered(true)} />;
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar sessions={sessions} activeId={activeId} onSelect={setActiveId} onNewSession={handleNewSession} />
      {activeSession ? (
        <ChatView session={activeSession} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Select or create a session to talk to Jerry.
        </div>
      )}
    </div>
  );
}

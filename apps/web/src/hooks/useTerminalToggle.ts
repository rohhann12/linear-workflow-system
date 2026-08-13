import { useEffect, useState } from 'react';

const isMac = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform ?? navigator.userAgent);

export function useTerminalToggle() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const modifier = isMac ? e.metaKey : e.ctrlKey;
      if (modifier && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return { open, setOpen, hint: isMac ? '⌘J' : 'Ctrl+J' };
}

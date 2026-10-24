import { useState, useEffect } from 'react';

export default function StatusBadge() {
  const [status, setStatus] = useState({ state: 'checking', model: null });

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/status');
        if (!res.ok) throw new Error('not ok');
        const data = await res.json();
        setStatus({
          state: data.keyConfigured ? 'online' : 'offline',
          model: data.model
        });
      } catch {
        setStatus({ state: 'offline', model: null });
      }
    };
    check();
  }, []);

  const labels = {
    checking: 'Connecting…',
    online:   'Model Ready',
    offline:  'Not Connected'
  };

  return (
    <div className={`status-badge ${status.state}`} title={status.model || ''}>
      <span className="status-dot" />
      <span>{labels[status.state]}</span>
      {status.state === 'online' && status.model && (
        <span style={{ opacity: 0.6, fontSize: '0.65rem', fontFamily: 'monospace' }}>
          {status.model}
        </span>
      )}
    </div>
  );
}

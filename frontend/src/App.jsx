import { useState, useCallback } from 'react';
import './index.css';
import StatusBadge from './components/StatusBadge';
import UploadPanel from './components/UploadPanel';
import ResultPanel from './components/ResultPanel';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const handleAnalyze = useCallback(async ({ file, location, description }) => {
    setIsLoading(true);
    setReport(null);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('image', file);
      if (location) formData.append('location', location);
      if (description) formData.append('description', description);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError({
          message: data.error || `HTTP ${res.status}: Unexpected error from server.`,
          code: data.code || 'API_ERROR',
          modelRequested: data.modelRequested,
          details: data.details || null,
        });
      } else {
        setReport(data.report);
      }
    } catch (err) {
      setError({
        message: err.message || 'Network error — could not reach backend. Ensure the backend server is running on port 5000.',
        code: 'NETWORK_ERROR',
        details: null,
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleReset = useCallback(() => {
    setReport(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return (
    <div className="app-wrapper">
      {/* Header */}
      <header className="app-header" role="banner">
        <div className="header-inner">
          <div className="brand" aria-label="CivicLens AI home">
            <div className="brand-icon" aria-hidden="true">🏙️</div>
            <div className="brand-text">
              <h1>CivicLens AI</h1>
              <p>See the issue. Understand the impact. Take action.</p>
            </div>
          </div>
          <StatusBadge />
        </div>
      </header>

      <main className="main-content" role="main">
        {/* Hero */}
        <section className="hero-banner" aria-labelledby="hero-title">
          <div className="hero-tag" aria-hidden="true">
            <span>⚡</span> Powered by Gemma 4 · Hosted AI
          </div>
          <h1 id="hero-title" className="hero-title">
            AI-Powered <span className="highlight">Civic Issue</span> Detection
          </h1>
          <p className="hero-sub">
            Upload a street photograph to instantly detect and analyze visible infrastructure
            problems — from potholes to drainage failures — powered by Google's hosted Gemma 4 model.
          </p>
        </section>

        {/* Main grid */}
        <div className="analysis-grid">
          <UploadPanel onAnalyze={handleAnalyze} isLoading={isLoading} />
          <ResultPanel
            report={report}
            isLoading={isLoading}
            error={error}
            onReset={handleReset}
          />
        </div>
      </main>

      <footer className="app-footer" role="contentinfo">
        <p>
          CivicLens AI · Powered by{' '}
          <a
            href="https://ai.google.dev"
            target="_blank"
            rel="noopener noreferrer"
          >
            Google Gen AI SDK
          </a>{' '}
          · Model: <strong>gemma-4-26b-a4b-it</strong>
        </p>
        <p>
          Analysis is based on visible image evidence only. No complaint is submitted automatically.
          All severity levels are visual assessments, not official engineering ratings.
        </p>
      </footer>
    </div>
  );
}

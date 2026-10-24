import { useState, useCallback, useEffect, useRef } from 'react';
import './index.css';
import StatusBadge from './components/StatusBadge';
import UploadPanel from './components/UploadPanel';
import ResultPanel from './components/ResultPanel';
import AuthModal from './components/AuthModal';
import UserNav from './components/UserNav';
import PublicRegistry from './components/PublicRegistry';
import { auth, onAuthStateChanged, saveToPublicRegistry } from './firebase';
import { Camera, Database, Sparkles } from 'lucide-react';

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  // Auth state
  const [user, setUser] = useState(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Firestore save state
  const [savedDoc, setSavedDoc] = useState(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [highlightedDocId, setHighlightedDocId] = useState(null);

  // Active view tab
  const [activeTab, setActiveTab] = useState('analyze'); // 'analyze' | 'registry'
  const registrySectionRef = useRef(null);

  // Last submitted payload for manual retry
  const lastPayloadRef = useRef(null);

  // Listen to Firebase auth changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  const handleSaveToPublic = useCallback(async (currentReport, location, description) => {
    if (!currentReport) return;
    setIsSavingDoc(true);
    setSaveError(null);

    try {
      const result = await saveToPublicRegistry({
        report: currentReport,
        location,
        description,
        user
      });
      setSavedDoc(result);
      setHighlightedDocId(result.id);
    } catch (err) {
      console.error('Failed to save to Firestore public collection:', err);
      setSaveError(err.message || 'Error writing to Firestore database.');
    } finally {
      setIsSavingDoc(false);
    }
  }, [user]);

  const handleAnalyze = useCallback(async ({ file, location, description }) => {
    setIsLoading(true);
    setReport(null);
    setError(null);
    setSavedDoc(null);
    setSaveError(null);

    lastPayloadRef.current = { location, description };

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
        // Automatically save record into the Firestore 'public' collection
        handleSaveToPublic(data.report, location, description);
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
  }, [handleSaveToPublic]);

  const handleReset = useCallback(() => {
    setReport(null);
    setError(null);
    setIsLoading(false);
    setSavedDoc(null);
    setSaveError(null);
  }, []);

  const handleViewInRegistry = useCallback((docId) => {
    setActiveTab('registry');
    setHighlightedDocId(docId);
    setTimeout(() => {
      registrySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
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

          <div className="header-right-tools">
            <StatusBadge />
            <UserNav user={user} onOpenAuth={() => setIsAuthOpen(true)} />
          </div>
        </div>
      </header>

      <main className="main-content" role="main">
        {/* Hero */}
        <section className="hero-banner" aria-labelledby="hero-title">
          <div className="hero-tag" aria-hidden="true">
            <span>⚡</span> Powered by Gemma 4 · Firebase Cloud Firestore
          </div>
          <h1 id="hero-title" className="hero-title">
            AI-Powered <span className="highlight">Civic Issue</span> Detection
          </h1>
          <p className="hero-sub">
            Upload street photographs to analyze visible infrastructure defects with Google Gemma 4.
            All verified submissions are synchronized directly into the public database registry.
          </p>

          {/* View Mode Switcher */}
          <div className="view-mode-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'analyze'}
              className={`view-tab-btn ${activeTab === 'analyze' ? 'active' : ''}`}
              onClick={() => setActiveTab('analyze')}
            >
              <Camera size={16} />
              <span>Capture & Analyze</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'registry'}
              className={`view-tab-btn ${activeTab === 'registry' ? 'active' : ''}`}
              onClick={() => setActiveTab('registry')}
            >
              <Database size={16} />
              <span>Public Registry (Firestore)</span>
            </button>
          </div>
        </section>

        {/* Content based on Active Tab */}
        {activeTab === 'analyze' ? (
          <div className="analysis-grid">
            <UploadPanel onAnalyze={handleAnalyze} isLoading={isLoading} />
            <ResultPanel
              report={report}
              isLoading={isLoading}
              error={error}
              onReset={handleReset}
              savedDoc={savedDoc}
              isSavingDoc={isSavingDoc}
              saveError={saveError}
              onSaveToPublic={() =>
                handleSaveToPublic(
                  report,
                  lastPayloadRef.current?.location,
                  lastPayloadRef.current?.description
                )
              }
              onViewInRegistry={handleViewInRegistry}
            />
          </div>
        ) : null}

        {/* Public Registry Section (always accessible or full view in registry tab) */}
        <div ref={registrySectionRef} className="registry-wrapper-section">
          <PublicRegistry highlightedDocId={highlightedDocId} />
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <footer className="app-footer" role="contentinfo">
        <p>
          CivicLens AI · Model: <strong>gemma-4-26b-a4b-it</strong> · Database: Cloud Firestore (<code>digitaltwin-13cdb</code> · Collection: <code>public</code>)
        </p>
        <p>
          Analysis is based on visible image evidence only. All records are saved under the public civic registry.
        </p>
      </footer>
    </div>
  );
}

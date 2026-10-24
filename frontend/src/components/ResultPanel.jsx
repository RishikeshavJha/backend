import { useState } from 'react';

function SectionTitle({ children }) {
  return <div className="section-title">{children}</div>;
}

function SeverityWidget({ severity }) {
  if (!severity) return null;
  const level = (severity.level || 'Uncertain').toUpperCase();
  return (
    <div className="severity-widget">
      <div className={`severity-level-block ${level}`}>
        <div className="sev-label">Severity</div>
        <div className="sev-value">{severity.level || 'Uncertain'}</div>
      </div>
      <div className="severity-rationale">{severity.rationale || 'No rationale provided.'}</div>
    </div>
  );
}

function EvidenceList({ items }) {
  if (!items || items.length === 0) return <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>No specific evidence listed.</p>;
  return (
    <ul className="evidence-list" aria-label="Visible evidence">
      {items.map((item, i) => (
        <li key={i}>
          <span className="evidence-dot">◆</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

function ImpactGrid({ impact }) {
  if (!impact) return null;
  const items = [
    { label: '🚶 Pedestrians', key: 'pedestrians' },
    { label: '🚗 Vehicles', key: 'vehicles' },
    { label: '🏗️ Infrastructure', key: 'infrastructure' },
  ];
  return (
    <div className="impact-grid">
      {items.map(({ label, key }) => (
        <div className="impact-card" key={key}>
          <div className="impact-card-label">{label}</div>
          <div className="impact-card-text">{impact[key] || 'N/A'}</div>
        </div>
      ))}
    </div>
  );
}

function ActionsList({ actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <ul className="actions-list" aria-label="Recommended actions">
      {actions.map((action, i) => (
        <li key={i}>
          <span style={{ color: 'var(--accent-teal)', flexShrink: 0 }}>→</span>
          {action}
        </li>
      ))}
    </ul>
  );
}

function SuggestedReport({ reportData }) {
  const [copied, setCopied] = useState(false);
  if (!reportData) return null;

  const fullText = [
    `TITLE: ${reportData.title || ''}`,
    `LOCATION: ${reportData.locationContext || ''}`,
    '',
    reportData.description || '',
    '',
    `URGENCY NOTE: ${reportData.urgencyNote || ''}`
  ].join('\n');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
      const el = document.createElement('textarea');
      el.value = fullText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="report-box">
      <div className="report-box-header">
        <span className="report-box-title">📋 Suggested Report Draft</span>
        <button
          type="button"
          className={`btn-copy ${copied ? 'copied' : ''}`}
          onClick={handleCopy}
          aria-label="Copy report to clipboard"
          id="copy-report-btn"
        >
          {copied ? '✓ Copied!' : '⎘ Copy'}
        </button>
      </div>
      <div className="report-box-body">
        {reportData.title && (
          <div className="report-field">
            <div className="report-field-label">Title</div>
            <div className="report-field-value" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {reportData.title}
            </div>
          </div>
        )}
        {reportData.locationContext && (
          <div className="report-field">
            <div className="report-field-label">Location Context</div>
            <div className="report-field-value">{reportData.locationContext}</div>
          </div>
        )}
        {reportData.description && (
          <div className="report-field">
            <div className="report-field-label">Description</div>
            <div className="report-field-value" style={{ whiteSpace: 'pre-wrap' }}>
              {reportData.description}
            </div>
          </div>
        )}
        {reportData.urgencyNote && (
          <div className="report-field">
            <div className="report-field-label">Urgency Note</div>
            <div className="report-field-value">{reportData.urgencyNote}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryBadge({ category, isCivicIssue }) {
  let cls = 'civic';
  if (isCivicIssue === false) cls = 'no-issue';
  if (category?.toLowerCase().includes('uncertain')) cls = 'uncertain';
  return (
    <span className={`report-category-badge ${cls}`}>
      {cls === 'civic' ? '⚠️' : cls === 'no-issue' ? '✅' : '❓'} {category || 'Unknown'}
    </span>
  );
}

function ConfidenceBadge({ score }) {
  if (!score) return null;
  return (
    <span className={`confidence-inline ${score}`}>
      {score === 'High' ? '●' : score === 'Medium' ? '◐' : '○'} {score} Confidence
    </span>
  );
}

export default function ResultPanel({
  report,
  isLoading,
  error,
  onReset,
  savedDoc,
  isSavingDoc,
  saveError,
  onSaveToPublic,
  onViewInRegistry
}) {
  if (isLoading) {
    return (
      <div className="card fade-in">
        <div className="card-header">
          <div className="card-icon">🔬</div>
          <h2>Analyzing…</h2>
        </div>
        <div className="loading-state">
          <div className="loading-orb">🏙️</div>
          <h3>Gemma 4 is examining the image</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Identifying visible civic issues via the hosted AI API…
          </p>
          <div className="loading-steps">
            {['Uploading image', 'Inspecting visual evidence', 'Assessing severity', 'Building report'].map((s, i) => (
              <div key={i} className="loading-step-row active">
                <span className="step-check">⟳</span> {s}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    const isModelError = error.code === 'MODEL_UNAVAILABLE';
    const isAuthError  = error.code === 'AUTH_ERROR';
    return (
      <div className="card fade-in">
        <div className="card-header">
          <div className="card-icon">⚠️</div>
          <h2>Analysis Failed</h2>
        </div>
        <div className="card-body">
          <div className="error-state">
            <div className="error-header">
              <span className="error-icon">🔴</span>
              <h3>
                {isModelError ? 'Model Unavailable' : isAuthError ? 'Authentication Error' : 'API Error'}
              </h3>
            </div>
            <div className="error-message">{error.message}</div>
            {isAuthError && (
              <div className="error-hint">
                ⚙️ Check your <code>GEMINI_API_KEY</code> in <code>backend/.env</code>. The key must have access to hosted Gemma 4 models.
              </div>
            )}
            {isModelError && (
              <div className="error-hint">
                ⚙️ The model <code>{error.modelRequested}</code> may not be available to your API key. Verify access by listing models via the Gen AI SDK.
              </div>
            )}
            {error.details?.suggestion && !isAuthError && !isModelError && (
              <div className="error-hint">💡 {error.details.suggestion}</div>
            )}
            <div className="error-actions">
              <button type="button" className="btn-secondary" onClick={onReset} id="retry-btn">
                ↩ Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="card">
        <div className="card-header">
          <div className="card-icon">📊</div>
          <h2>Analysis Results</h2>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <h3>No analysis yet</h3>
          <p>Upload a photo of a civic infrastructure issue and click Analyze to get an AI-generated report.</p>
          <div className="empty-steps">
            {[
              'Upload a street or public area photo',
              'Optionally add location context',
              'Click Analyze to run AI detection',
              'Review the structured issue report',
            ].map((s, i) => (
              <div key={i} className="empty-step">
                <span className="step-num">{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const r = report;

  return (
    <div className="card fade-in">
      <div className="result-card-header">
        <h2>
          <span className="card-icon" style={{ display: 'inline-flex', width: 28, height: 28, fontSize: 13 }}>📊</span>
          Issue Report
          {r.meta && (
            <span className="info-chip" style={{ marginLeft: 8 }}>
              {r.meta.model}
            </span>
          )}
        </h2>
        <div className="result-actions">
          <button type="button" className="btn-secondary" onClick={onReset} id="reset-btn">
            ↩ Reset
          </button>
        </div>
      </div>

      <div className="report-scroll">
        <div className="report-container">

          {/* Category + confidence */}
          <div className="report-top">
            <CategoryBadge category={r.issueCategory} isCivicIssue={r.isCivicIssue} />
            <ConfidenceBadge score={r.confidenceScore} />
          </div>

          {/* Cloud Firestore Public Collection Sync Card */}
          {savedDoc ? (
            <div className="firestore-saved-banner">
              <div className="firestore-saved-header">
                <div className="firestore-saved-title">
                  <span className="live-pulse-dot" />
                  <span>Saved to Database · Collection: <code>public</code></span>
                </div>
                {onViewInRegistry && (
                  <button
                    type="button"
                    className="btn-view-registry"
                    onClick={() => onViewInRegistry(savedDoc.id)}
                  >
                    View in Feed ↓
                  </button>
                )}
              </div>
              <div className="firestore-saved-meta">
                <div>
                  <span className="meta-label">Document ID:</span>{' '}
                  <code className="saved-id">{savedDoc.id}</code>
                </div>
                <div>
                  <span className="meta-label">Action:</span>{' '}
                  <code className="saved-action">{savedDoc.action || 'REPORTED_CIVIC_ISSUE'}</code>
                </div>
                <div>
                  <span className="meta-label">Timestamp:</span>{' '}
                  <span>{savedDoc.timestamp}</span>
                </div>
              </div>
            </div>
          ) : isSavingDoc ? (
            <div className="firestore-saving-banner">
              <span className="saving-spinner" />
              <span>Saving report to Firestore <code>public</code> collection...</span>
            </div>
          ) : saveError ? (
            <div className="firestore-error-banner">
              <span>⚠️ Could not auto-save to Firestore: {saveError}</span>
              {onSaveToPublic && (
                <button type="button" className="btn-retry-save" onClick={onSaveToPublic}>
                  Retry Save
                </button>
              )}
            </div>
          ) : null}

          {/* Summary */}
          {r.summary && (
            <div className="report-summary">{r.summary}</div>
          )}

          {/* Severity */}
          {r.severity && (
            <>
              <SectionTitle>🌡️ Apparent Severity</SectionTitle>
              <SeverityWidget severity={r.severity} />
            </>
          )}

          {/* Evidence */}
          {r.visibleEvidence?.length > 0 && (
            <>
              <SectionTitle>👁 Visible Evidence</SectionTitle>
              <EvidenceList items={r.visibleEvidence} />
            </>
          )}

          {/* Impact */}
          {r.potentialImpact && (
            <>
              <SectionTitle>🎯 Potential Impact</SectionTitle>
              <ImpactGrid impact={r.potentialImpact} />
            </>
          )}

          {/* Actions */}
          {r.recommendedActions?.length > 0 && (
            <>
              <SectionTitle>✅ Recommended Actions</SectionTitle>
              <ActionsList actions={r.recommendedActions} />
            </>
          )}

          {/* Suggested Report */}
          {r.suggestedReport && (
            <>
              <SectionTitle>📋 Suggested Civic Report</SectionTitle>
              <SuggestedReport reportData={r.suggestedReport} />
            </>
          )}

          {/* Uncertainty */}
          {r.uncertaintyAndAssumptions && (
            <>
              <SectionTitle>⚠️ Uncertainty & Limitations</SectionTitle>
              <div className="uncertainty-box">
                <span className="uncertainty-icon">⚠️</span>
                <span>{r.uncertaintyAndAssumptions}</span>
              </div>
            </>
          )}

          {/* Meta */}
          {r.meta && (
            <div className="model-strip">
              <span>🤖 Model:</span>
              <code>{r.meta.model}</code>
              <span className="separator">|</span>
              <span>Analyzed:</span>
              <span>{new Date(r.meta.analyzedAt).toLocaleTimeString()}</span>
              {r.meta.mimeType && (
                <>
                  <span className="separator">|</span>
                  <span>{r.meta.mimeType}</span>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { subscribeToPublicRegistry } from '../firebase';
import {
  Database,
  ExternalLink,
  RefreshCw,
  MapPin,
  Clock,
  Shield,
  Layers,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  Building,
  CheckCircle2
} from 'lucide-react';

export default function PublicRegistry({ highlightedDocId }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('ALL');

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToPublicRegistry((items, err) => {
      setLoading(false);
      if (err) {
        setError(err.message || 'Unable to connect to Firestore.');
      } else {
        setReports(items);
        setError(null);
      }
    }, 50);

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (highlightedDocId) {
      setExpandedId(highlightedDocId);
    }
  }, [highlightedDocId]);

  const filteredReports = reports.filter((item) => {
    if (filter === 'ALL') return true;
    return item.severity?.toUpperCase() === filter;
  });

  const getSeverityClass = (sev) => {
    const s = (sev || '').toUpperCase();
    if (s === 'CRITICAL' || s === 'HIGH') return 'badge-sev-high';
    if (s === 'MEDIUM') return 'badge-sev-med';
    return 'badge-sev-low';
  };

  return (
    <section className="public-registry-card" aria-labelledby="public-registry-title">
      <div className="registry-header">
        <div className="registry-title-group">
          <div className="registry-icon-badge" aria-hidden="true">
            <Database size={20} />
          </div>
          <div>
            <div className="registry-tag">
              <span className="live-dot" />
              <span>Cloud Firestore · Collection: <code>public</code></span>
            </div>
            <h2 id="public-registry-title">Public Civic Registry Feed</h2>
            <p className="registry-sub">
              All reports created through CivicLens AI are directly written to Firestore under the collection <code>public</code>.
            </p>
          </div>
        </div>

        <div className="registry-controls">
          <div className="filter-pill-group">
            {['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`filter-pill ${filter === lvl ? 'active' : ''}`}
                onClick={() => setFilter(lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && reports.length === 0 ? (
        <div className="registry-loading">
          <RefreshCw size={24} className="spin-icon" />
          <p>Listening to Firestore <code>public</code> collection updates...</p>
        </div>
      ) : error ? (
        <div className="registry-error-box">
          <div className="registry-error-top">
            <AlertTriangle size={20} className="error-alert-icon" />
            <div>
              <h4 className="error-title">Firestore Security Rules Required</h4>
              <p className="error-desc">
                Cloud Firestore requires an explicit rule allowing read/write access to the <code>public</code> collection.
              </p>
            </div>
          </div>

          <div className="rules-guide-box">
            <div className="rules-guide-step">
              <span className="step-badge">1</span>
              <span>
                Open Firebase Console Rules:{' '}
                <a
                  href="https://console.firebase.google.com/project/digitaltwin-13cdb/firestore/rules"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rules-console-link"
                >
                  Firebase Console → Firestore Rules <ExternalLink size={12} className="inline-ext" />
                </a>
              </span>
            </div>

            <div className="rules-guide-step">
              <span className="step-badge">2</span>
              <span>Add this rule inside <code>match /databases/{'{'}database{'}'}/documents</code>:</span>
            </div>

            <pre className="rules-code-snippet">
{`match /public/{docId} {
  allow read, write: if true;
}`}
            </pre>

            <div className="rules-guide-step">
              <span className="step-badge">3</span>
              <span>Click <strong>Publish</strong> in the Firebase Console, then click:</span>
            </div>

            <button
              type="button"
              className="btn-retry-connection"
              onClick={() => {
                setLoading(true);
                setError(null);
                subscribeToPublicRegistry((items, err) => {
                  setLoading(false);
                  if (err) {
                    setError(err.message || 'Unable to connect to Firestore.');
                  } else {
                    setReports(items);
                    setError(null);
                  }
                }, 50);
              }}
            >
              <RefreshCw size={14} />
              <span>Retry Connection</span>
            </button>
          </div>
        </div>
      ) : reports.length === 0 ? (
        <div className="registry-empty">
          <Database size={36} className="empty-icon" />
          <h3>No public records in collection <code>public</code> yet</h3>
          <p>Analyze any street photo above — your report will automatically be committed here!</p>
        </div>
      ) : (
        <div className="registry-feed">
          <div className="registry-stats-row">
            <span>
              Showing <strong>{filteredReports.length}</strong> of <strong>{reports.length}</strong> public records
            </span>
            <span className="db-badge">Project: <code>digitaltwin-13cdb</code></span>
          </div>

          <div className="registry-list">
            {filteredReports.map((item) => {
              const isExpanded = expandedId === item.id;
              const isNew = item.id === highlightedDocId;

              return (
                <div
                  key={item.id}
                  className={`registry-item ${isNew ? 'highlighted-item' : ''}`}
                >
                  <div
                    className="item-summary-row"
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isExpanded}
                  >
                    <div className="item-meta-left">
                      {item.imageUrl ? (
                        <div className="item-thumbnail-wrap" title="Uploaded photo evidence">
                          <img src={item.imageUrl} alt="" className="item-thumbnail-img" />
                        </div>
                      ) : (
                        <div className="item-thumbnail-placeholder" title="No photo uploaded">
                          📷
                        </div>
                      )}
                      <span className={`severity-tag ${getSeverityClass(item.severity)}`}>
                        {item.severity || 'Medium'}
                      </span>
                      <div className="item-title-wrap">
                        <div className="item-action-line">
                          <code className="doc-action">{item.action || 'REPORTED_CIVIC_ISSUE'}</code>
                          <span className="doc-id-pill" title="Firestore Document ID">
                            ID: {item.id}
                          </span>
                        </div>
                        <h4 className="item-title">{item.issueTitle || 'Civic Infrastructure Issue'}</h4>
                      </div>
                    </div>

                    <div className="item-meta-right">
                      <div className="meta-time-user">
                        <span className="meta-time">
                          <Clock size={13} />
                          {item.timestamp || new Date(item.timestampMs || Date.now()).toLocaleTimeString()}
                        </span>
                        <span className="meta-user" title={item.adminEmail || item.reporter?.email}>
                          {item.adminEmail || item.reporter?.email || 'Public Citizen'}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="btn-expand-item"
                        aria-label={isExpanded ? 'Collapse record' : 'Expand record'}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="item-detail-drawer">
                      {/* Uploaded Street Photo Display */}
                      {item.imageUrl && (
                        <div className="detail-photo-card">
                          <div className="detail-photo-bar">
                            <span className="photo-label">📸 Uploaded Street Evidence Photo</span>
                            <a
                              href={item.imageUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="btn-view-full-img"
                              onClick={(e) => e.stopPropagation()}
                            >
                              Open Full Size ↗
                            </a>
                          </div>
                          <div className="evidence-photo-box">
                            <img
                              src={item.imageUrl}
                              alt={item.issueTitle || 'Street issue photograph'}
                              className="evidence-photo-img"
                              loading="lazy"
                            />
                          </div>
                        </div>
                      )}

                      <div className="detail-grid">
                        <div className="detail-col">
                          <span className="detail-label">Location:</span>
                          <span className="detail-val">
                            <MapPin size={14} className="inline-icon" /> {item.location || 'Unspecified'}
                          </span>
                        </div>

                        <div className="detail-col">
                          <span className="detail-label">Category:</span>
                          <span className="detail-val">
                            <Layers size={14} className="inline-icon" /> {item.category || 'General'}
                          </span>
                        </div>

                        <div className="detail-col">
                          <span className="detail-label">Routing Department:</span>
                          <span className="detail-val">
                            <Building size={14} className="inline-icon" /> {item.recommendedDepartment || 'Municipal Authority'}
                          </span>
                        </div>

                        <div className="detail-col">
                          <span className="detail-label">Status:</span>
                          <span className="detail-val status-open">
                            <CheckCircle2 size={14} className="inline-icon" /> {item.status || 'OPEN'}
                          </span>
                        </div>
                      </div>

                      <div className="detail-block">
                        <span className="detail-label">Details / Description:</span>
                        <p className="detail-text">{item.details || item.userDescription || 'No description provided.'}</p>
                      </div>

                      {item.suggestedAction && (
                        <div className="detail-block">
                          <span className="detail-label">Suggested Municipal Action:</span>
                          <p className="detail-text highlight-box">{item.suggestedAction}</p>
                        </div>
                      )}

                      {/* Raw Firestore Document Snapshot matching user's console format */}
                      <div className="raw-doc-preview">
                        <div className="raw-doc-bar">
                          <span>Firestore Document Fields (<code>public/{item.id}</code>)</span>
                        </div>
                        <pre className="raw-doc-json">
{`action: "${item.action || 'REPORTED_CIVIC_ISSUE'}"
adminEmail: "${item.adminEmail || item.reporter?.email || 'public-reporter@civiclens.local'}"
details: "${(item.details || '').slice(0, 80)}..."
imageUrl: "${item.imageUrl ? (item.imageUrl.startsWith('data:') ? 'data:image/jpeg;base64... (stored in Firestore)' : item.imageUrl) : 'null'}"
issueTitle: "${item.issueTitle || ''}"
severity: "${item.severity || 'Medium'}"
teamId: "${item.teamId || item.reporter?.uid || 'guest'}"
teamName: "${item.teamName || 'Public Citizen Reports'}"
timestamp: "${item.timestamp || ''}"
timestampMs: ${item.timestampMs || Date.now()}`}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

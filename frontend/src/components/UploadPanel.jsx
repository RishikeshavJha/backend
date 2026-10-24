import { useState, useRef, useCallback } from 'react';

const MAX_FILE_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

export default function UploadPanel({ onAnalyze, isLoading }) {
  const [dragging, setDragging] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileError, setFileError] = useState(null);
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const inputRef = useRef(null);

  const validateAndSet = useCallback((f) => {
    setFileError(null);
    if (!f) return;

    if (!ALLOWED_TYPES.includes(f.type)) {
      setFileError('Unsupported format. Please upload a JPEG, PNG, or WebP image.');
      return;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setFileError(`File exceeds ${MAX_FILE_SIZE_MB} MB limit.`);
      return;
    }

    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSet(dropped);
  }, [validateAndSet]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragging(true); }, []);
  const handleDragLeave = useCallback(() => setDragging(false), []);

  const handleInputChange = (e) => {
    validateAndSet(e.target.files[0]);
    e.target.value = '';
  };

  const handleRemove = () => {
    setFile(null);
    setPreview(null);
    setFileError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!file) return;
    onAnalyze({ file, location: location.trim(), description: description.trim() });
  };

  const canSubmit = file && !fileError && !isLoading;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-icon">📷</div>
        <h2>Upload & Analyze</h2>
      </div>
      <div className="card-body">
        <form onSubmit={handleSubmit} noValidate>
          {/* Drop Zone / Preview */}
          {!file ? (
            <div
              className={`drop-zone ${dragging ? 'dragging' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              aria-label="Upload civic issue image"
              onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept={ALLOWED_EXTS.join(',')}
                onChange={handleInputChange}
                aria-label="Select image file"
                id="file-input"
              />
              <span className="drop-icon">🏙️</span>
              <h3>Drop your photo here</h3>
              <p>
                or <span className="browse-link">browse files</span>
              </p>
              <p style={{ marginTop: 8, fontSize: '0.72rem' }}>
                JPEG · PNG · WebP · up to {MAX_FILE_SIZE_MB} MB
              </p>
            </div>
          ) : (
            <div className="preview-wrap">
              <img src={preview} alt="Uploaded civic issue photo preview" />
              <div className="preview-actions">
                <button
                  type="button"
                  className="icon-btn danger"
                  onClick={handleRemove}
                  aria-label="Remove image"
                  title="Remove image"
                  disabled={isLoading}
                >
                  ✕
                </button>
              </div>
              <div className="preview-file-info">
                <span>📄</span>
                <span>{file.name}</span>
                <span className="file-size">{formatBytes(file.size)}</span>
              </div>
            </div>
          )}

          {fileError && (
            <div className="field-error" role="alert">
              ⚠ {fileError}
            </div>
          )}

          {/* Location */}
          <div className="form-group">
            <label htmlFor="location">
              Location <span>(optional — unverified citizen note)</span>
            </label>
            <input
              id="location"
              type="text"
              className="form-input"
              placeholder="e.g. 5th Ave near Central Park, New York"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={200}
              disabled={isLoading}
              aria-describedby="location-note"
            />
            <p id="location-note" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
              This text is passed as context only — the AI does not geolocate your image.
            </p>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">
              Your Observation <span>(optional)</span>
            </label>
            <textarea
              id="description"
              className="form-textarea"
              placeholder="Describe what you see — e.g. 'Large pothole visible at junction, exposing road base material'"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              disabled={isLoading}
              rows={3}
            />
          </div>

          {/* Analyze button */}
          <button
            type="submit"
            className="btn-analyze"
            disabled={!canSubmit}
            aria-busy={isLoading}
            id="analyze-btn"
          >
            {isLoading ? (
              <>
                <span className="spinner" />
                Analyzing with Gemma 4…
              </>
            ) : (
              <>
                🔍 Analyze Civic Issue
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

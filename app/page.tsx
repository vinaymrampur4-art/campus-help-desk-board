'use client';

/**
 * app/page.tsx — Campus Help Desk Board
 *
 * Client component that:
 *  - Fetches the latest 10 help requests on load (GET /api/requests)
 *  - Increments the board views counter on load (GET /api/views)
 *  - Allows students to post new requests (POST /api/requests)
 *  - Shows the cache source (Redis / PostgreSQL) and view count
 *  - Handles loading, error, and empty states
 */

import { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────
interface HelpRequest {
  id: number;
  student_name: string;
  message: string;
  created_at: string;
}

interface RequestsResponse {
  source: 'Redis' | 'PostgreSQL';
  requests: HelpRequest[];
  error?: string;
}

interface ViewsResponse {
  views: number | null;
  available: boolean;
  message?: string;
}

// ── Helpers ───────────────────────────────────────────────────
function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ── Component ─────────────────────────────────────────────────
export default function HomePage() {
  // Form state
  const [studentName, setStudentName] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Board state
  const [requests, setRequests] = useState<HelpRequest[]>([]);
  const [source, setSource] = useState<'Redis' | 'PostgreSQL' | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [requestsError, setRequestsError] = useState('');

  // Views state
  const [views, setViews] = useState<number | null>(null);
  const [viewsAvailable, setViewsAvailable] = useState(true);

  // ── Fetch requests from GET /api/requests ─────────────────
  async function fetchRequests() {
    setLoadingRequests(true);
    setRequestsError('');
    try {
      const res = await fetch('/api/requests');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: RequestsResponse = await res.json();
      setRequests(data.requests);
      setSource(data.source);
    } catch (err) {
      setRequestsError('Failed to load requests. Check your connection.');
      console.error('[fetchRequests]', err);
    } finally {
      setLoadingRequests(false);
    }
  }

  // ── Increment + fetch view count from GET /api/views ──────
  async function fetchViews() {
    try {
      const res = await fetch('/api/views');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ViewsResponse = await res.json();
      setViews(data.views);
      setViewsAvailable(data.available);
    } catch (err) {
      setViewsAvailable(false);
      console.error('[fetchViews]', err);
    }
  }

  // ── On mount: load requests and increment views ────────────
  useEffect(() => {
    fetchRequests();
    fetchViews();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Form submission ────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const name = studentName.trim();
    const msg = message.trim();

    // Client-side validation (mirrors server validation)
    if (!name) { setFormError('Student name is required.'); return; }
    if (!msg) { setFormError('Help request message is required.'); return; }
    if (name.length > 50) { setFormError('Student name must be 50 characters or fewer.'); return; }
    if (msg.length > 200) { setFormError('Message must be 200 characters or fewer.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_name: name, message: msg }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFormError(data.error || 'Failed to submit. Please try again.');
        return;
      }

      setFormSuccess(`Request submitted successfully! (ID: ${data.id})`);
      setStudentName('');
      setMessage('');
      // Refresh request list — Redis cache was invalidated by the POST
      await fetchRequests();
    } catch (err) {
      setFormError('Network error. Please try again.');
      console.error('[handleSubmit]', err);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <main className="container">
      {/* Header */}
      <header className="header">
        <h1>🎓 Campus Help Desk Board</h1>
        <p>Post your questions and get help from the campus community.</p>
      </header>

      {/* Stats bar */}
      <div className="stats-bar">
        {/* Views counter */}
        {viewsAvailable ? (
          <span className="badge badge-views">
            👁 {views !== null ? `${views} view${views !== 1 ? 's' : ''}` : 'Loading views…'}
          </span>
        ) : (
          <span className="badge badge-unavailable">👁 Views unavailable</span>
        )}

        {/* Cache source indicator */}
        {source === 'Redis' && (
          <span className="badge badge-redis">⚡ Served from Redis cache</span>
        )}
        {source === 'PostgreSQL' && (
          <span className="badge badge-pg">🗄 Served from PostgreSQL</span>
        )}
      </div>

      {/* ── Post Request Form ── */}
      <div className="card">
        <h2>Post a Help Request</h2>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="studentName">Student Name</label>
            <input
              id="studentName"
              type="text"
              placeholder="Enter your name"
              value={studentName}
              onChange={(e) => { setStudentName(e.target.value); setFormError(''); setFormSuccess(''); }}
              maxLength={60}
              autoComplete="name"
              disabled={submitting}
            />
            <div className={`char-count ${studentName.length > 50 ? 'over' : ''}`}>
              {studentName.length}/50
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="message">Help Request</label>
            <textarea
              id="message"
              rows={4}
              placeholder="Describe your issue or question…"
              value={message}
              onChange={(e) => { setMessage(e.target.value); setFormError(''); setFormSuccess(''); }}
              maxLength={220}
              disabled={submitting}
            />
            <div className={`char-count ${message.length > 200 ? 'over' : ''}`}>
              {message.length}/200
            </div>
          </div>

          {formError && <div className="alert alert-error" role="alert">{formError}</div>}
          {formSuccess && <div className="alert alert-success" role="status">{formSuccess}</div>}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting}
            style={{ marginTop: '1rem' }}
          >
            {submitting ? (
              <><span className="spinner" aria-hidden="true" />Posting…</>
            ) : (
              'Post Request'
            )}
          </button>
        </form>
      </div>

      {/* ── Latest Requests ── */}
      <div className="card">
        <div className="requests-header">
          <h2>Latest Help Requests</h2>
          <button
            className="btn"
            onClick={() => { fetchRequests(); fetchViews(); }}
            disabled={loadingRequests}
            style={{ padding: '.4rem .9rem', fontSize: '.82rem', background: '#f1f5f9', border: '1px solid #dde3ea', borderRadius: '7px', fontWeight: 600 }}
          >
            {loadingRequests ? '…' : '↻ Refresh'}
          </button>
        </div>

        {loadingRequests && (
          <div className="loading-state">
            <span className="spinner" aria-hidden="true" />
            Loading requests…
          </div>
        )}

        {!loadingRequests && requestsError && (
          <div className="alert alert-error" role="alert">{requestsError}</div>
        )}

        {!loadingRequests && !requestsError && requests.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <p>No help requests yet. Be the first to post one!</p>
          </div>
        )}

        {!loadingRequests && !requestsError && requests.length > 0 && (
          <ol className="requests-list" style={{ listStyle: 'none' }}>
            {requests.map((req) => (
              <li key={req.id} className="request-item">
                <div className="request-meta">
                  <span className="request-name">{req.student_name}</span>
                  <span className="request-time">{formatTime(req.created_at)}</span>
                </div>
                <p className="request-message">{req.message}</p>
              </li>
            ))}
          </ol>
        )}
      </div>
    </main>
  );
}

# Campus Help Desk Board

**SRN:** PES1UG24AM455  
**Stack:** Next.js 16 (App Router) · TypeScript · PostgreSQL 17 · Redis (Memurai) · Node.js

---

## Architecture

```
Browser
  │
  ├─ GET  /api/views       → Redis INCR  help:views
  ├─ GET  /api/requests    → Redis cache-aside (help:latest, TTL 60s) → PostgreSQL
  └─ POST /api/requests    → PostgreSQL INSERT → invalidate Redis help:latest
```

## Prerequisites

- Node.js ≥ 18
- PostgreSQL 17 running on localhost:5432
- Memurai (Redis-compatible) running on localhost:6379

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure credentials
#    Edit .env.local and replace YOUR_PASSWORD_HERE with your postgres password

# 3. Create the database and table (run in psql or pgAdmin)
CREATE DATABASE helpdesk_db;
\c helpdesk_db
CREATE TABLE help_requests (
  id           SERIAL PRIMARY KEY,
  student_name VARCHAR(50)  NOT NULL,
  message      VARCHAR(200) NOT NULL,
  created_at   TIMESTAMP    DEFAULT now()
);

# 4. Start development server
npm run dev
```

Open http://localhost:3000

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/requests | Submit a help request |
| GET  | /api/requests | Fetch latest 10 requests (cached) |
| GET  | /api/views    | Increment and return board view count |

## Testing Scenarios

| Test | Steps | Expected |
|------|-------|----------|
| 1 | POST valid request | `{ success: true, id: N }` |
| 2 | GET requests (cold cache) | `source: "PostgreSQL"` |
| 3 | GET requests within 60s | `source: "Redis"` |
| 4 | POST another request | Cache invalidated, next GET → PostgreSQL |
| 5 | Refresh board | View counter increments |
| 6 | POST with empty name | `{ success: false, error: "..." }` |
| 7 | POST with empty message | `{ success: false, error: "..." }` |
| 8 | Stop Memurai service | App still serves from PostgreSQL |
| 9 | Restart Memurai | Caching resumes normally |

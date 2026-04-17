# Contact Book — Web Deployment Architecture

## Current State (Local / Single-User)

| Layer | Technology |
|-------|-----------|
| API framework | FastAPI |
| ORM | SQLAlchemy 2 |
| Database | SQLite (file-based) |
| Server | Uvicorn (single process) |

This is sufficient for a single developer or small team running locally, but several things must change before the application can serve many concurrent users reliably.

---

## Changes Required for Production Web Deployment

### 1. Replace SQLite with a Client–Server Database

SQLite does not handle concurrent writes well and is not accessible from multiple app instances.

**Recommended:** PostgreSQL

- Supports full ACID transactions, row-level locking, and connection pooling.
- The SQLAlchemy models need no changes — only the `DATABASE_URL` in `database.py` changes:
  ```
  DATABASE_URL = "postgresql+psycopg2://user:pass@db-host:5432/contacts"
  ```
- Add `psycopg2-binary` (or `asyncpg` for async) to requirements.

### 2. Run Multiple App Workers Behind a Load Balancer

A single Uvicorn process is a single point of failure and cannot use more than one CPU core.

```
                 ┌─────────────────┐
  Internet  ──►  │  Load Balancer  │  (Nginx / AWS ALB)
                 └────────┬────────┘
            ┌─────────────┼─────────────┐
            ▼             ▼             ▼
       [Worker 1]    [Worker 2]    [Worker 3]
       Uvicorn        Uvicorn        Uvicorn
       (Gunicorn      (Gunicorn      (Gunicorn
        worker)        worker)        worker)
            └─────────────┼─────────────┘
                          ▼
                    PostgreSQL DB
```

Run with Gunicorn as a process manager:
```bash
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker
```

### 3. Add Authentication & Authorization

In a multi-user deployment each person should only see their own contacts.

- Use **JWT-based auth** (OAuth2 password flow is already built into FastAPI).
- Add a `user_id` foreign key to the `contacts` table.
- All queries are filtered by the authenticated user's ID.
- For social login (Google, GitHub), use an identity provider and exchange tokens.

### 4. Database Migrations

Stop using `Base.metadata.create_all()` (only good for greenfield); use **Alembic** for schema migrations so production data is never lost during upgrades.

```bash
alembic init alembic
alembic revision --autogenerate -m "add user_id to contacts"
alembic upgrade head
```

### 5. Input Validation & Rate Limiting

- Pydantic schemas already enforce types; add stricter phone-number validation (e.g. `phonenumbers` library).
- Apply per-IP and per-user rate limits with **slowapi** (a FastAPI-compatible rate limiter) to prevent abuse.

### 6. Containerisation & Orchestration

Package the app as a Docker image so it runs identically in every environment.

```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["gunicorn", "main:app", "-w", "4", "-k", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
```

Use **Kubernetes** (or AWS ECS / Render / Fly.io for simpler deployments) to manage scaling, health checks, and rolling deploys.

### 7. Observability

| Concern | Tool |
|---------|------|
| Structured logging | `structlog` → CloudWatch / Datadog |
| Metrics | Prometheus + Grafana |
| Distributed tracing | OpenTelemetry |
| Error tracking | Sentry |

### 8. Caching (optional, for scale)

For large address books or frequent search queries, add **Redis**:
- Cache full-text search results with a short TTL (30 s).
- Store session tokens / JWT deny-lists.

---

## Target Production Architecture Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Client (Browser / Mobile App)                           │
└──────────────────┬───────────────────────────────────────┘
                   │ HTTPS
┌──────────────────▼───────────────────────────────────────┐
│  CDN / WAF  (CloudFront, Cloudflare)                     │
│  • TLS termination   • DDoS protection                   │
└──────────────────┬───────────────────────────────────────┘
                   │
┌──────────────────▼───────────────────────────────────────┐
│  Load Balancer  (Nginx / AWS ALB)                        │
└──────┬───────────┬───────────┬────────────────────────────┘
       │           │           │
┌──────▼──┐  ┌─────▼──┐  ┌────▼───┐
│ App Pod │  │App Pod │  │App Pod │   ← FastAPI + Gunicorn
└──────┬──┘  └─────┬──┘  └────┬───┘      (Kubernetes)
       └───────────┼───────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
  ┌──────────┐ ┌────────┐ ┌────────────┐
  │PostgreSQL│ │ Redis  │ │ Object     │
  │(primary +│ │(cache) │ │ Storage    │
  │ replica) │ └────────┘ │(avatars)   │
  └──────────┘            └────────────┘
```

---

## Summary of Key Changes

| Area | Local (current) | Production |
|------|----------------|------------|
| Database | SQLite | PostgreSQL with replicas |
| Process model | Single Uvicorn | Gunicorn + multiple Uvicorn workers |
| Auth | None | JWT / OAuth2 |
| Migrations | `create_all()` | Alembic |
| Infra | `uvicorn main:app` | Docker + Kubernetes / managed PaaS |
| Caching | None | Redis |
| Observability | Print logs | Structured logs + Prometheus + Sentry |

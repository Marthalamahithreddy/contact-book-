# Scaling the Contact Book — Real World Pointers

## Database

- Swap SQLite for PostgreSQL; it handles concurrent writes and supports connection pooling
- Add read replicas — route all `GET` queries to replicas, writes go to primary only
- Index `first_name`, `last_name`, and `email` columns; partial indexes for common filters
- For full-text search at scale, move search off SQL and onto Elasticsearch or Postgres `tsvector`
- Partition the contacts table by user or region once row count becomes large
- Use a connection pooler like PgBouncer between the app and the database

## Application Layer

- Replace single Uvicorn process with Gunicorn + multiple Uvicorn workers
- Move to async SQLAlchemy so DB I/O does not block the event loop
- Containerise with Docker; run on Kubernetes or a managed platform (ECS, Cloud Run, Fly.io)
- Horizontal scaling behind a load balancer — stateless app servers, shared DB

## Auth and Multi-Tenancy

- Add a `user_id` column to contacts and filter every query by it
- JWT-based auth with short expiry and a Redis-backed token deny-list for logout
- Rate-limit per user with a sliding window counter in Redis

## Caching

- Cache the full contact list per user in Redis with a short TTL (30–60 s), invalidate on write
- Cache search results for popular queries
- Use HTTP `ETag` / `Cache-Control` headers on list endpoints

## Search

- For a large dataset, offload search to Elasticsearch or Typesense
- Index contacts asynchronously via a message queue (Celery + Redis or RabbitMQ) so writes are never blocked by indexing

## Storage

- If you add avatars or attachments, store them in object storage (S3, GCS) not on disk
- Serve assets through a CDN

## Observability

- Structured JSON logs shipped to a log aggregator (Datadog, Loki)
- Prometheus metrics + Grafana dashboards for request rate, latency, error rate
- Distributed tracing with OpenTelemetry across API + DB calls
- Error tracking with Sentry

## Reliability

- Database connection retries with exponential backoff
- Circuit breaker around external calls
- Health and readiness endpoints for orchestrator probe checks
- Regular automated DB backups with tested restore procedures

## CI/CD

- Alembic migrations run as a pre-deploy step, never inside app startup
- Blue/green or rolling deployments to avoid downtime during releases
- Automated integration tests that hit a real test DB, not mocks

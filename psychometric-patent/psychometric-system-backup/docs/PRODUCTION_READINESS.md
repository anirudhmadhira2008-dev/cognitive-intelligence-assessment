# Production Readiness & Deployment Playbook

---

## 1. Environment Policy & Secrets

Production mode (`NODE_ENV=production`) strictly enforces:
- `MONGO_URI`: Must be set to a valid MongoDB connection string.
- `JWT_SECRET`: Must be set to a secure string with minimum length of 32 characters.
- Fail-Closed Behavior: Server startup terminates immediately if required production secrets are missing.

---

## 2. Docker Orchestration

The `docker-compose.yml` orchestrates:
- `mongodb`: Mongo database server
- `backend`: Express API + Socket.IO real-time server
- `frontend`: Vite React SPA

---

## 3. Health Monitoring & Graceful Shutdown

- Health Endpoint: `GET /api/health`
- Graceful Shutdown: `SIGTERM` and `SIGINT` signals close HTTP server connections and disconnect MongoDB cleanly.

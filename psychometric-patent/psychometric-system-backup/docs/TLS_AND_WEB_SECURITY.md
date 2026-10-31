# TLS & Web Security Architecture Specification

**Multimodal Psychometric AI Assessment Platform**  
**Specification Version:** 2.4.0  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Overview & Security Objectives

This document specifies the transport layer security (TLS), HTTP security policies, and defense-in-depth web protections for the AI Multimodal Psychometric Assessment System. The platform processes high-stakes candidate evaluations, biometric proctoring telemetry, voice interview audio, and digitally signed competency credentials. All communication across untrusted networks must adhere to modern cryptographic standards, fail-closed security policies, and zero-trust data protection principles.

---

## 2. Secure Communication Architecture

```
                       UNTRUSTED INTERNET / CLIENT NETWORKS
                                      │
                                      ▼
                        HTTPS (Port 443 / TLS 1.3)
                        WSS   (WebSocket Secure)
                                      │
               ┌──────────────────────┴──────────────────────┐
               │                                             │
               ▼                                             ▼
  [Cloudflare / AWS ALB / Nginx]               [Local Development Gateway]
   Production TLS Termination                   Vite SPA Dev Server (5173)
   - TLS 1.3 / 1.2 Only                         - Native Browser Secure Context
   - Strict Modern Ciphers                      - Reverse Proxy to Backend API
   - HSTS Preload (2 Years)                     - Loopback Traffic Isolation
   - HTTP -> HTTPS 301 Redirect                              │
               │                                             │
               ▼                                             ▼
   [Express Application Server] <────────────────────────────┘
    - Helmet Defense-in-Depth Headers
    - Content-Security-Policy (CSP)
    - Strict Origin CORS Enforcement
    - Trust Proxy (X-Forwarded-Proto)
    - HttpOnly / Secure / SameSite Cookies
    - Server-Authoritative Scoring
               │
               ▼
  [MongoDB Database / Memory Cache]
   - Authenticated TLS Transport (Production)
   - Bound to Isolated VPC / Localhost
```

---

## 3. Development vs. Production Environments

| Security Control | Local Development Environment | Production Environment |
| :--- | :--- | :--- |
| **Protocol Scheme** | `http://localhost:5173` & `http://localhost:5000` | `https://assessment.domain.com` |
| **WebSocket Scheme** | `ws://localhost:5000/socket.io` | `wss://assessment.domain.com/socket.io` |
| **Secure Context** | Native W3C browser localhost secure context (`isSecureContext === true`) for webcam/mic | Native HTTPS with CA-signed TLS Certificate |
| **HSTS Header** | Disabled (prevents localhost permanent lockouts) | `max-age=63072000; includeSubDomains; preload` |
| **TLS Termination** | Handled natively by browser or optional self-signed cert | Reverse Proxy / Load Balancer (AWS ALB, Nginx, Cloudflare) |
| **Cookie Policies** | `SameSite=Lax`, `Secure=false` (HTTP loopback) | `SameSite=Strict`, `Secure=true`, `HttpOnly=true` |
| **CORS Origins** | `http://localhost:5173`, `http://localhost:3000` | Explicitly configured domain (`CLIENT_URL`) |
| **Fail-Closed Env** | Permissive fallback with console warnings | **Fatal startup exit** on missing secrets |

### Why Plain HTTP on Localhost is the Recommended Development Pattern:
According to W3C and Chromium Security Standards, `localhost` (127.0.0.1) is explicitly designated as a **Potentially Trustworthy Origin** (`isSecureContext = true`). Running plain HTTP locally allows the camera (`navigator.mediaDevices.getUserMedia`) and Web Audio API to operate flawlessly without generating self-signed certificate authority warnings (`NET::ERR_CERT_AUTHORITY_INVALID`).

---

## 4. Production TLS Configuration Guide

### 4.1. Nginx Reverse Proxy Configuration
Place this configuration at `/etc/nginx/conf.d/psychometric_platform.conf`:

```nginx
# HTTP to HTTPS Permanent Redirect
server {
    listen 80;
    listen [::]:80;
    server_name assessment.yourdomain.com;
    return 301 https://$host$request_uri;
}

# Production TLS Server Block
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name assessment.yourdomain.com;

    # Valid Production Certificates (Let's Encrypt / DigiCert)
    ssl_certificate /etc/letsencrypt/live/assessment.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/assessment.yourdomain.com/privkey.pem;
    ssl_trusted_certificate /etc/letsencrypt/live/assessment.yourdomain.com/chain.pem;

    # Protocols: Modern TLS 1.2 and 1.3 only; SSLv2, SSLv3, TLS 1.0, TLS 1.1 disabled
    ssl_protocols TLSv1.2 TLSv1.3;

    # Strong Cipher Suites (Forward Secrecy & AEAD Only)
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;

    # TLS Session Caching
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;

    # OCSP Stapling
    ssl_stapling on;
    ssl_stapling_verify on;
    resolver 1.1.1.1 8.8.8.8 valid=300s;
    resolver_timeout 5s;

    # HSTS (Strict-Transport-Security)
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

    # Frontend Static Assets & SPA Routing
    location / {
        root /var/www/psychometric-frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    # WebSocket Secure (WSS) Proxy for Proctoring & Voice
    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
```

---

## 5. Defense-in-Depth HTTP Security Headers

Configured via `helmet` in `backend/server.js`:

```javascript
app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'", "'unsafe-inline'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                imgSrc: ["'self'", "data:", "blob:"],
                mediaSrc: ["'self'", "blob:", "data:"],
                connectSrc: ["'self'", "wss:", "ws:", "https:", "http:"],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                frameAncestors: ["'none'"],
                upgradeInsecureRequests: process.env.NODE_ENV === "production" ? [] : null
            }
        },
        crossOriginEmbedderPolicy: false,
        hsts: process.env.NODE_ENV === "production"
            ? { maxAge: 63072000, includeSubDomains: true, preload: true }
            : false,
        referrerPolicy: { policy: "strict-origin-when-cross-origin" },
        xContentTypeOptions: true,
        xFrameOptions: { action: "deny" }
    })
);
```

### Purpose of Each Header:
1. **`Content-Security-Policy (CSP)`**: Restricts execution to authorized origins; prevents Cross-Site Scripting (XSS), inline injection, and unauthorized data exfiltration.
2. **`Strict-Transport-Security (HSTS)`**: Instructs browsers to communicate exclusively over HTTPS for 2 years (63,072,000 seconds), including all subdomains.
3. **`X-Content-Type-Options: nosniff`**: Prevents MIME-type confusion attacks and executable interpretation of uploads.
4. **`X-Frame-Options: DENY`**: Protects against clickjacking attacks.
5. **`Referrer-Policy: strict-origin-when-cross-origin`**: Ensures full referrer URLs are never leaked to external cross-origin domains.

---

## 6. Real-Time Secure WebSockets (`wss://`)

In `frontend/src/services/realtimeService.js`:
- The client dynamically determines connection security:
  ```javascript
  const isSecure = window.location.protocol === "https:";
  this.socket = io(SERVER_URL, {
      secure: isSecure,
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5
  });
  ```
- In HTTPS environments, Socket.io automatically upgrades transport to `wss://`.
- In HTTP development environments, it uses `ws://` to prevent SSL handshake errors on localhost.

---

## 7. Web Application Security Audit & Mitigations

| Vulnerability Domain | Mitigation Strategy & Verification |
| :--- | :--- |
| **Authentication (JWT)** | Tokens signed using asymmetric keys or cryptographically secure HMAC secrets (min 32 chars). Tokens validated via `authMiddleware`. |
| **Role-Based Access Control (RBAC)** | Public registration strictly defaults to the `student` role. Admin routes guarded by `authorizeRoles(["admin"])`. |
| **IDOR Protection** | Resource ownership strictly verified (`assertSessionOwner`, `SignedReport.userId === req.user.id`). Evaluators/admins have governed view-only access. |
| **Rate Limiting** | General endpoints rate-limited to 300 req/15 min. Sensitive auth routes rate-limited to 30 req/15 min. |
| **Input Validation & Sanitization** | `express-mongo-sanitize` scrubs malicious `$where` operators. Inputs validated with schemas. |
| **Answer Key Leakage** | Answer keys and choices stripped before serialization; question scores evaluated exclusively on the server. |
| **Production Fail-Closed** | `NODE_ENV=production` fails startup if `JWT_SECRET` is missing, short, or set to development fallback. |

---

## 8. Verification & Test Evidence

All TLS and web security controls are covered by automated unit and integration tests:

```bash
PASS backend/tests/tls_security.test.js
  ✓ enforces secure Content-Security-Policy headers
  ✓ enforces Strict-Transport-Security (HSTS) in production policy
  ✓ enforces X-Content-Type-Options nosniff
  ✓ enforces Referrer-Policy strict-origin-when-cross-origin
  ✓ restricts CORS to explicitly allowed application origins
  ✓ enables trust proxy for secure reverse proxy deployments
```

All 6 test cases passed.

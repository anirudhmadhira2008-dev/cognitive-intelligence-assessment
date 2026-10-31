# Local Setup, Development & Production Deployment Guide

## 1. Prerequisites
- **Node.js:** v18.0.0 or higher (v20+ LTS recommended)
- **MongoDB:** v6.0 or higher running locally on default port `27017` (or MongoDB Atlas URI)
- **npm:** v9.0.0 or higher
- **Modern Browser:** Chrome, Chromium, Firefox, or Edge supporting WebRTC, Web Audio API, and MediaRecorder.

---

## 2. Local Development Environment Setup

### Step 1: Clone & Directory Navigation
```bash
cd psychometric-patent/psychometric-system-backup
```

### Step 2: Backend Configuration & Start
```bash
cd backend
npm install
```

Configure `.env` in `backend/`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/psychometric_pilot
JWT_SECRET=super_secure_32_characters_secret_key_here!
FRONTEND_URL=http://localhost:5173
```

Run database migrations & test definition seeding:
```bash
node scripts/migrate_assessment_v3.js
```

Start the backend server:
```bash
npm run dev
# Server listening on http://localhost:5000
```

Run backend test suites:
```bash
npm test
```

### Step 3: Frontend Configuration & Start
In a new terminal window:
```bash
cd psychometric-patent/psychometric-system-backup/frontend
npm install
npm run dev
# Frontend live at http://localhost:5173
```

Build production assets:
```bash
npm run build
```

---

## 3. Remote / Multi-IP Network Access Configuration

To allow participants to take the assessment from different IP addresses (e.g. testing across campus or at home):

### Step 1: Bind Backend to Network Interface
In `backend/server.js`, verify `server.listen(PORT, "0.0.0.0", ...)` is bound to all network interfaces.

### Step 2: Frontend Environment Setting
In `frontend/.env.production` or `frontend/.env.local`:
```env
VITE_API_URL=https://api.yourdomain.com
```
(Or your server host IP: `http://192.168.1.100:5000`)

### Step 3: HTTPS & Camera Permissions (Critical)
Modern browsers require a **Secure Context** (HTTPS or `localhost`) to access the webcam and microphone (`navigator.mediaDevices.getUserMedia`).
For non-localhost domain deployments:
- Configure an SSL reverse proxy (Nginx or Caddy) with Let's Encrypt certificates.
- Example Nginx block:
```nginx
server {
    listen 443 ssl http2;
    server_name assessment.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:5173; # or serve dist/
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /socket.io/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
    }
}
```

---

## 4. Production Security Checklist Before Pilot Launch
1. Ensure `NODE_ENV=production` is set in production `.env`.
2. Ensure `JWT_SECRET` is at least 32 cryptographically random characters.
3. Validate MongoDB authentication credentials and TLS connection.
4. Verify rate limiting is enabled (`express-rate-limit` is active in production).
5. Ensure candidate photos and audio storage adhere to the 30-day retention sweep.

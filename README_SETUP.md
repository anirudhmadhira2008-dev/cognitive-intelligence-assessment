# Multimodal AI Psychometric Examination Platform
### Quick Start Guide for Collaborators & Friends

Welcome! This repository contains the complete full-stack **Multimodal AI Psychometric Examination Platform** (React 18 + Vite frontend, Node.js + Express 5 backend, MongoDB, and in-browser face proctoring).

---

## ⚡ Super Easy 1-Click Launch (Windows)

1. **First-time setup:** Double-click `install.bat` (this automatically installs all backend and frontend dependencies).
2. **Launch the platform:** Double-click `run.bat`.
   - It will map the project to virtual drive `P:` (to avoid Windows path length issues).
   - Starts the Backend API on port `5000`.
   - Starts the Frontend Vite server on `http://localhost:5173`.
   - Automatically opens `http://localhost:5173` in your default browser!

---

## 💻 Manual Setup (macOS / Linux / Windows Terminal)

### Prerequisites
- Node.js (v18, v20, or v22+)
- MongoDB (running locally on `mongodb://127.0.0.1:27017` or configured in `backend/.env`)

### 1. Backend Setup
```bash
cd psychometric-patent/psychometric-system-backup/backend
npm install
npm run dev
```
Backend API will start at: `http://localhost:5000`

### 2. Frontend Setup
```bash
cd psychometric-patent/psychometric-system-backup/frontend
npm install
npm run dev
```
Frontend Web App will start at: `http://localhost:5173`

---

## 🔑 Default Roles & Features
- **Register a Student:** Go to `http://localhost:5173/register`. The AI camera alignment frame will verify your face orientation before allowing photo enrollment.
- **Admin Dashboard:** Access analytics and student evaluations at `/admin`.
- **Proctoring & Camera:** Uses `face-api.js` directly in the browser (zero external video streaming required).

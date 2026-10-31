/**
 * Production API Client for Multimodal Psychometric Assessment System
 * Features low-bandwidth resilience, offline response queue, and exponential backoff retry.
 */

const BASE_URL = import.meta.env.VITE_API_URL || "";

// In-Memory & LocalStorage Offline Action Queue
const QUEUE_STORAGE_KEY = "psy_assessment_offline_queue";

const getAuthHeaders = () => {
    const token = localStorage.getItem("token");
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {})
    };
};

/**
 * Loads pending offline queue items
 */
export const getOfflineQueue = () => {
    try {
        const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

/**
 * Enqueues a failed request to replay when connection restores
 */
export const enqueueOfflineRequest = (endpoint, options = {}) => {
    try {
        const queue = getOfflineQueue();
        const entry = {
            id: "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
            endpoint,
            method: options.method || "POST",
            body: typeof options.body === "string" ? options.body : null,
            timestamp: Date.now()
        };
        queue.push(entry);
        localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue.slice(-50))); // Keep last 50
    } catch (e) {
        console.warn("Could not save to offline queue:", e);
    }
};

/**
 * Replays queued offline requests when connection returns
 */
export const flushOfflineQueue = async () => {
    const queue = getOfflineQueue();
    if (!queue || queue.length === 0) return { replayed: 0 };

    const remaining = [];
    let replayed = 0;

    for (const item of queue) {
        try {
            await fetch(`${BASE_URL}${item.endpoint}`, {
                method: item.method,
                headers: getAuthHeaders(),
                body: item.body
            });
            replayed++;
        } catch (err) {
            console.warn(`Replay failed for ${item.endpoint}, keeping in queue:`, err.message);
            remaining.push(item);
        }
    }

    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(remaining));
    return { replayed, remaining: remaining.length };
};

// Automatic window online reconnection listener
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        console.log("Network online restored. Flusing queued assessment responses...");
        flushOfflineQueue().catch(() => {});
    });
}

/**
 * Sleep helper for exponential backoff
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Primary HTTP Request with Exponential Backoff
 */
export const apiRequest = async (endpoint, options = {}, retries = 2) => {
    const url = `${BASE_URL}${endpoint}`;
    const headers = {
        ...getAuthHeaders(),
        ...(options.headers || {})
    };

    if (options.body instanceof FormData) {
        delete headers["Content-Type"];
    }

    let attempt = 0;
    while (attempt <= retries) {
        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                if (response.status === 401) {
                    const currentPath = window.location.pathname;
                    if (currentPath !== "/login" && currentPath !== "/register" && currentPath !== "/") {
                        localStorage.removeItem("token");
                        localStorage.removeItem("user");
                    }
                }
                throw new Error(data.message || `Request failed with status ${response.status}`);
            }

            return data;
        } catch (error) {
            attempt++;
            const isNetworkError = error.name === "TypeError" || error.message.includes("fetch") || error.message.includes("NetworkError");

            if (isNetworkError && attempt <= retries) {
                const backoffMs = Math.pow(2, attempt) * 500; // 1s, 2s
                console.warn(`[Network Retry] ${endpoint} attempt ${attempt}/${retries} failed. Retrying in ${backoffMs}ms...`);
                await sleep(backoffMs);
                continue;
            }

            // If it's a candidate answer or progress record, save to queue on final network failure
            if (isNetworkError && (endpoint.includes("/answer") || endpoint.includes("/progress"))) {
                enqueueOfflineRequest(endpoint, options);
            }

            console.error(`API Error [${endpoint}]:`, error.message);
            throw error;
        }
    }
};

// API Resource Modules
export const api = {
    // Authentication
    auth: {
        login: (credentials) => apiRequest("/api/auth/login", { method: "POST", body: JSON.stringify(credentials) }),
        register: (userData) => apiRequest("/api/auth/register", { method: "POST", body: JSON.stringify(userData) }),
        getMe: () => apiRequest("/api/auth/me", { method: "GET" }),
        logout: () => {
            localStorage.removeItem("token");
            localStorage.removeItem("user");
        }
    },

    // Server-Authoritative Adaptive Assessment Engine
    assessment: {
        start: (setupData) => apiRequest("/api/assessment/start", { method: "POST", body: JSON.stringify(setupData) }),
        startSession: (setupData) => apiRequest("/api/assessment/start", { method: "POST", body: JSON.stringify(setupData) }),
        getNextQuestion: (difficulty, attempted, lastCorrect, sessionId) => {
            const params = new URLSearchParams();
            if (difficulty) params.append("difficulty", difficulty);
            if (attempted && attempted.length > 0) params.append("attempted", attempted.join(","));
            if (lastCorrect !== null && lastCorrect !== undefined) params.append("lastCorrect", lastCorrect);
            if (sessionId) params.append("sessionId", sessionId);
            return apiRequest(`/api/assessment/next-question?${params.toString()}`, { method: "GET" });
        },
        recordAnswer: (answerPayload) => apiRequest("/api/assessment/answer", { method: "POST", body: JSON.stringify(answerPayload) }),
        verifyAnswer: (answerData) => apiRequest("/api/assessment/verify-answer", { method: "POST", body: JSON.stringify(answerData) }),
        recordProgress: (progressData) => apiRequest("/api/assessment/progress", { method: "POST", body: JSON.stringify(progressData) }),
        submitSession: (sessionData) => apiRequest("/api/assessment/submit", { method: "POST", body: JSON.stringify(sessionData) }),
        getMySessions: () => apiRequest("/api/assessment/sessions/my", { method: "GET" }),
        getSessionById: (id) => apiRequest(`/api/assessment/sessions/${id}`, { method: "GET" }),
        getTestDefinitions: () => apiRequest("/api/assessment/tests", { method: "GET" }),
        getTestDefinitionById: (testId) => apiRequest(`/api/assessment/tests/${testId}`, { method: "GET" }),
        getVoicePrompts: () => apiRequest("/api/assessment/voice-questions", { method: "GET" })
    },

    // Results & Reports
    results: {
        getMyResults: () => apiRequest("/api/results/my", { method: "GET" }),
        getLatest: () => apiRequest("/api/results/latest", { method: "GET" }),
        getById: (id) => apiRequest(`/api/results/${id}`, { method: "GET" }),
        getAll: () => apiRequest("/api/results", { method: "GET" })
    },

    // Reports with RFC 8785 Digital Signatures
    reports: {
        generate: (sessionId) => apiRequest(`/api/reports/generate/${sessionId}`, { method: "POST" }),
        getById: (id) => apiRequest(`/api/reports/${id}`, { method: "GET" }),
        getMy: () => apiRequest("/api/reports/my", { method: "GET" }),
        verify: (payload) => apiRequest("/api/reports/verify", { method: "POST", body: JSON.stringify(payload) }),
        getPublicKeys: () => apiRequest("/api/reports/public-keys", { method: "GET" }),
        getPerformanceAnalysis: () => apiRequest("/api/reports/performance-analysis", { method: "GET" }),
        getDownloadUrl: (id) => `${BASE_URL}/api/reports/${id}/download`
    },

    // AI Verbal & Voice Assessment
    voice: {
        verifySentence: (formData) => apiRequest("/api/voice/verify-sentence", { method: "POST", body: formData }),
        evaluate: (formData) => apiRequest("/api/voice/evaluate", { method: "POST", body: formData }),
        generateProbe: (probeData) => apiRequest("/api/voice/generate-probe", { method: "POST", body: JSON.stringify(probeData) }),
        getSubmissions: (page = 1) => apiRequest(`/api/voice/submissions?page=${page}`, { method: "GET" }),
        getSubmission: (sessionId) => apiRequest(`/api/voice/submission/${sessionId}`, { method: "GET" }),
        submitOverride: (sessionId, overrideData) => apiRequest(`/api/voice/override/${sessionId}`, { method: "POST", body: JSON.stringify(overrideData) })
    },

    // Admin & Evaluator Portal
    admin: {
        getOverview: () => apiRequest("/api/admin/overview", { method: "GET" }),
        getCandidates: (page = 1, search = "") => apiRequest(`/api/admin/candidates?page=${page}&search=${encodeURIComponent(search)}`, { method: "GET" }),
        getSessions: (page = 1, filter = "") => apiRequest(`/api/admin/sessions?page=${page}${filter ? `&decision=${encodeURIComponent(filter)}` : ""}`, { method: "GET" }),
        getSessionDetail: (id) => apiRequest(`/api/admin/sessions/${id}`, { method: "GET" }),
        updateStatus: (candidateId, data) => apiRequest(`/api/admin/candidates/${candidateId}/status`, { method: "PATCH", body: JSON.stringify(data) }),
        getQuestions: (page = 1, search = "") => apiRequest(`/api/admin/questions?page=${page}&search=${encodeURIComponent(search)}`, { method: "GET" }),
        createQuestion: (data) => apiRequest("/api/admin/questions", { method: "POST", body: JSON.stringify(data) }),
        getAuditLogs: (page = 1) => apiRequest(`/api/admin/audit-logs?page=${page}`, { method: "GET" }),
        getCohortAnalytics: () => apiRequest("/api/admin/analytics/cohorts", { method: "GET" }),
        getProctoringAnalytics: () => apiRequest("/api/admin/analytics/proctoring", { method: "GET" }),
        exportResearchDataUrl: (format = "csv", testId = "", cohortId = "") => 
            `${BASE_URL}/api/admin/export?format=${format}${testId ? `&testId=${testId}` : ""}${cohortId ? `&cohortId=${cohortId}` : ""}`
    },

    // Candidate Enrollment & Identity Verification
    enrollment: {
        getMyEnrollments: () => apiRequest("/api/enrollment/my", { method: "GET" }),
        verifyIdentity: (enrollmentId, data) => apiRequest(`/api/enrollment/${enrollmentId}/verify-identity`, { method: "POST", body: JSON.stringify(data) }),
        create: (enrollData) => apiRequest("/api/enrollment/create", { method: "POST", body: JSON.stringify(enrollData) }),
        verify: (verifyData) => apiRequest("/api/enrollment/verify", { method: "POST", body: JSON.stringify(verifyData) }),
        getStatus: (candidateId) => apiRequest(`/api/enrollment/status/${candidateId}`, { method: "GET" }),
        manualApprove: (enrollmentId, notes = "") => apiRequest(`/api/enrollment/${enrollmentId}/manual-approve`, { method: "POST", body: JSON.stringify({ notes }) })
    }
};

export default api;

import { io } from "socket.io-client";

let socket = null;

export const connectSocket = (token) => {
    if (socket && socket.connected) return socket;

    const isSecure = window.location.protocol === "https:";
    const socketUrl = import.meta.env.VITE_API_URL || window.location.origin;

    socket = io(socketUrl, {
        auth: { token: token || localStorage.getItem("token") },
        transports: ["websocket", "polling"],
        secure: isSecure,
        rejectUnauthorized: true,
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000
    });

    socket.on("connect", () => {
        console.log("🔌 Connected to Real-time Proctoring Socket Server:", socket.id);
    });

    socket.on("disconnect", (reason) => {
        console.log("🔌 Real-time Socket Disconnected:", reason);
    });

    return socket;
};

export const joinSessionRoom = (sessionId) => {
    if (socket && sessionId) {
        socket.emit("join_session", { sessionId });
    }
};

export const emitProctoringEvent = (eventData) => {
    if (socket && socket.connected) {
        socket.emit("proctoring_event", eventData);
    }
};

export const subscribeToTelemetry = (callback) => {
    if (socket) {
        socket.on("telemetry_update", callback);
        socket.on("live_proctoring_event", callback);
    }
    return () => {
        if (socket) {
            socket.off("telemetry_update", callback);
            socket.off("live_proctoring_event", callback);
        }
    };
};

export const disconnectSocket = () => {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
};

export default {
    connectSocket,
    joinSessionRoom,
    emitProctoringEvent,
    subscribeToTelemetry,
    disconnectSocket
};

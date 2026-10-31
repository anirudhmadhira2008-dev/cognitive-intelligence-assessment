import api from "../api/apiClient";

export const registerUser = async (userData) => {
    try {
        const response = await api.auth.register(userData);
        if (response.token) {
            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user));
        }
        return response;
    } catch (error) {
        return { error: error.message || "Registration failed" };
    }
};

export const loginUser = async (credentials) => {
    try {
        const response = await api.auth.login(credentials);
        if (response.token) {
            localStorage.setItem("token", response.token);
            localStorage.setItem("user", JSON.stringify(response.user));
        }
        return response;
    } catch (error) {
        return { error: error.message || "Invalid credentials" };
    }
};

export const logoutUser = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.href = "/login";
};

export const getUser = () => {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch {
        return null;
    }
};

export const getToken = () => {
    return localStorage.getItem("token");
};

export const isAuthenticated = () => {
    return Boolean(localStorage.getItem("token"));
};

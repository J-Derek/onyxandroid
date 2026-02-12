/**
 * Onyx Streaming - Auth API
 * API calls for authentication and profile management
 */

const API_BASE = import.meta.env.VITE_API_URL || "";

// Request timeout in milliseconds
const REQUEST_TIMEOUT_MS = 10000;

// Helper for fetch with timeout
async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
        console.log(`[Auth] Fetching: ${url}`);
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        console.log(`[Auth] Response from ${url}: ${response.status}`);
        return response;
    } catch (error) {
        clearTimeout(timeoutId);
        console.error(`[Auth] Error fetching ${url}:`, error);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new Error("Connection timeout. The server took too long to respond.");
        }
        throw error;
    }
}

// Token storage
const ACCESS_TOKEN_KEY = "onyx_access_token";
const REFRESH_TOKEN_KEY = "onyx_refresh_token";

export function getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(access: string, refresh: string) {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
}

export function clearTokens() {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
}

// Types
export interface User {
    id: number;
    username: string;
    email: string;
    is_admin: boolean;
}

export interface Profile {
    id: number;
    name: string;
    avatar_url: string | null;
    theme: string;
    has_pin: boolean;
}

export interface TokenResponse {
    access_token: string;
    refresh_token: string;
    token_type: string;
    user_id: number;
    username: string;
}

// Helper for authenticated requests
async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const token = getAccessToken();
    const headers = new Headers(options.headers);

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    return fetchWithTimeout(url, { ...options, headers });
}

// Auth endpoints
export async function register(username: string, email: string, password: string): Promise<TokenResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
    });

    if (!res.ok) {
        let detail = "Registration failed";
        try {
            const error = await res.json();
            detail = error.detail || detail;
        } catch {
            detail = `Server error (${res.status})`;
        }
        throw new Error(detail);
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
}

export async function login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetchWithTimeout(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
        let detail = "Login failed";
        try {
            const error = await res.json();
            detail = error.detail || detail;
        } catch {
            detail = `Server error (${res.status})`;
        }
        throw new Error(detail);
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
}

export async function getMe(): Promise<User> {
    const res = await authFetch(`${API_BASE}/api/auth/me`);

    if (!res.ok) {
        throw new Error("Not authenticated");
    }

    return res.json();
}

export async function refreshToken(): Promise<TokenResponse | null> {
    const refresh = getRefreshToken();
    if (!refresh) return null;

    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${refresh}`,
        },
    });

    if (!res.ok) {
        clearTokens();
        return null;
    }

    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data;
}

export function logout() {
    clearTokens();
}

// Profile endpoints
export async function getProfiles(): Promise<Profile[]> {
    const res = await authFetch(`${API_BASE}/api/profiles`);

    if (!res.ok) {
        throw new Error("Failed to load profiles");
    }

    return res.json();
}

export async function createProfile(name: string, avatarUrl?: string): Promise<Profile> {
    const res = await authFetch(`${API_BASE}/api/profiles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, avatar_url: avatarUrl }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to create profile");
    }

    return res.json();
}

export async function updateProfile(id: number, data: Partial<Profile>): Promise<Profile> {
    const res = await authFetch(`${API_BASE}/api/profiles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        throw new Error("Failed to update profile");
    }

    return res.json();
}

export async function deleteProfile(id: number): Promise<void> {
    const res = await authFetch(`${API_BASE}/api/profiles/${id}`, {
        method: "DELETE",
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to delete profile");
    }
}

export async function verifyProfilePin(profileId: number, pin: string): Promise<boolean> {
    const res = await authFetch(`${API_BASE}/api/profiles/${profileId}/verify-pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
    });

    return res.ok;
}

export async function setProfilePin(profileId: number, pin: string): Promise<void> {
    const res = await authFetch(`${API_BASE}/api/profiles/${profileId}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to set PIN");
    }
}

export async function removeProfilePin(profileId: number): Promise<void> {
    const res = await authFetch(`${API_BASE}/api/profiles/${profileId}/pin`, {
        method: "DELETE",
    });

    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.detail || "Failed to remove PIN");
    }
}

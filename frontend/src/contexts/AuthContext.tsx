/**
 * Onyx Streaming - Auth Context
 * Global authentication state management
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
    User,
    Profile,
    getMe,
    getProfiles,
    logout as apiLogout,
    getAccessToken,
    refreshToken,
    login as apiLogin,
    register as apiRegister,
} from "@/lib/auth";

interface AuthContextType {
    // User state
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Profile state
    profiles: Profile[];
    activeProfile: Profile | null;

    // Actions
    checkAuth: () => Promise<boolean>;
    login: (email: string, password: string) => Promise<void>;
    register: (username: string, email: string, password: string) => Promise<void>;
    setUser: (user: User | null) => void;
    setProfiles: (profiles: Profile[]) => void;
    selectProfile: (profile: Profile) => void;
    logout: () => void;
    refreshProfiles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [activeProfile, setActiveProfile] = useState<Profile | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const isAuthenticated = !!user;

    // Check if user is authenticated on mount
    const checkAuth = useCallback(async (): Promise<boolean> => {
        console.log("[AuthContext] checkAuth called");
        const token = getAccessToken();
        console.log("[AuthContext] Token found:", !!token);
        if (!token) {
            console.log("[AuthContext] No token, setting isLoading to false");
            setIsLoading(false);
            return false;
        }

        try {
            const userData = await getMe();
            setUser(userData);

            // Load profiles
            const profilesData = await getProfiles();
            setProfiles(profilesData);

            // Restore active profile from localStorage
            const savedProfileId = localStorage.getItem("onyx_active_profile");
            if (savedProfileId) {
                const savedProfile = profilesData.find(p => p.id === parseInt(savedProfileId));
                if (savedProfile) {
                    setActiveProfile(savedProfile);
                }
            }

            setIsLoading(false);
            return true;
        } catch (error) {
            console.error("Auth check failed:", error);
            // Try to refresh token
            try {
                const refreshed = await refreshToken();
                if (refreshed) {
                    const userData = await getMe();
                    setUser(userData);
                    const profilesData = await getProfiles();
                    setProfiles(profilesData);
                    setIsLoading(false);
                    return true;
                }
            } catch (refreshError) {
                console.error("Token refresh failed:", refreshError);
            }

            // Clear everything on failure
            apiLogout();
            setUser(null);
            setProfiles([]);
            setActiveProfile(null);
            setIsLoading(false);
            return false;
        }
    }, []);

    // Login function
    const login = useCallback(async (email: string, password: string): Promise<void> => {
        const response = await apiLogin(email, password);
        const userData = await getMe();
        setUser(userData);

        const profilesData = await getProfiles();
        setProfiles(profilesData);

        // Auto-select first profile if only one exists
        if (profilesData.length === 1) {
            setActiveProfile(profilesData[0]);
            localStorage.setItem("onyx_active_profile", profilesData[0].id.toString());
        }

        // Notify contexts to reinitialize with new user data
        window.dispatchEvent(new CustomEvent("onyx-user-changed"));
    }, []);

    // Register function
    const register = useCallback(async (username: string, email: string, password: string): Promise<void> => {
        const response = await apiRegister(username, email, password);
        const userData = await getMe();
        setUser(userData);

        const profilesData = await getProfiles();
        setProfiles(profilesData);

        // Auto-select newly created profile
        if (profilesData.length > 0) {
            setActiveProfile(profilesData[0]);
            localStorage.setItem("onyx_active_profile", profilesData[0].id.toString());
        }

        // Notify contexts to reinitialize with new user data
        window.dispatchEvent(new CustomEvent("onyx-user-changed"));
    }, []);

    const selectProfile = useCallback((profile: Profile) => {
        setActiveProfile(profile);
        localStorage.setItem("onyx_active_profile", profile.id.toString());
    }, []);

    const logout = useCallback(() => {
        apiLogout();
        setUser(null);
        setProfiles([]);
        setActiveProfile(null);

        // 🔒 SECURITY: Clear all user-scoped localStorage
        localStorage.removeItem("onyx_active_profile");
        localStorage.removeItem("onyx_last_played");
        localStorage.removeItem("onyx_crossfade");
        localStorage.removeItem("onyx_unlocked_profiles");

        // Dispatch event to notify all contexts to reset their state
        window.dispatchEvent(new CustomEvent("onyx-user-changed"));
    }, []);

    const refreshProfiles = useCallback(async () => {
        try {
            const profilesData = await getProfiles();
            setProfiles(profilesData);

            // Update active profile if it still exists
            if (activeProfile) {
                const updated = profilesData.find(p => p.id === activeProfile.id);
                if (updated) {
                    setActiveProfile(updated);
                }
            }
        } catch (error) {
            console.error("Failed to refresh profiles:", error);
        }
    }, [activeProfile]);

    // Check auth on mount
    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    const value: AuthContextType = {
        user,
        isAuthenticated,
        isLoading,
        profiles,
        activeProfile,
        checkAuth,
        login,
        register,
        setUser,
        setProfiles,
        selectProfile,
        logout,
        refreshProfiles,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within AuthProvider");
    }
    return context;
}

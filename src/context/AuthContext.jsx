import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authService } from "../services/authService";
import { userService } from "../services/userService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [firebaseUser, setFirebaseUser] = useState(undefined);
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(false);
    const [profileError, setProfileError] = useState("");

    useEffect(() => authService.observe(setFirebaseUser), []);

    useEffect(() => {
        if (firebaseUser === undefined) return undefined;
        if (!firebaseUser) {
            setProfile(null);
            setProfileLoading(false);
            setProfileError("");
            return undefined;
        }

        let active = true;
        let settleTimer = null;
        setProfileLoading(true);
        setProfileError("");

        const unsubscribe = userService.subscribeProfile(
            firebaseUser.uid,
            (next) => {
                if (!active) return;
                window.clearTimeout(settleTimer);
                if (next) {
                    setProfile(next);
                    setProfileLoading(false);
                    setProfileError("");
                    return;
                }
                // A just-registered user may briefly have no profile document
                // while the create request is still in flight. Give it a moment
                // before showing an error.
                setProfile(null);
                setProfileLoading(true);
                settleTimer = window.setTimeout(() => {
                    if (!active) return;
                    setProfileLoading(false);
                    setProfileError(
                        "Your profile could not be found. Please sign in again."
                    );
                }, 2000);
            },
            (error) => {
                if (!active) return;
                window.clearTimeout(settleTimer);
                setProfileLoading(false);
                setProfileError(error.message || "Could not load your profile.");
            }
        );

        return () => {
            active = false;
            window.clearTimeout(settleTimer);
            unsubscribe();
        };
    }, [firebaseUser]);

    const hasProfile = Boolean(profile);

    useEffect(() => {
        if (!firebaseUser || !hasProfile) return undefined;
        userService.touchLastSeen(firebaseUser.uid);
        const timer = window.setInterval(
            () => userService.touchLastSeen(firebaseUser.uid),
            120000
        );
        return () => window.clearInterval(timer);
    }, [firebaseUser, hasProfile]);

    const refreshProfile = useCallback(async () => {
        if (!firebaseUser) return null;
        setProfileLoading(true);
        try {
            const next = await userService.getProfile(firebaseUser.uid);
            setProfile(next);
            setProfileError(next ? "" : "Your profile could not be found. Please sign in again.");
            return next;
        } catch (error) {
            setProfileError(error.message || "Could not load your profile.");
            return null;
        } finally {
            setProfileLoading(false);
        }
    }, [firebaseUser]);

    const logout = useCallback(() => authService.logout(), []);

    const value = useMemo(
        () => ({
            firebaseUser,
            user: firebaseUser,
            uid: firebaseUser?.uid || null,
            profile,
            profileError,
            authLoading: firebaseUser === undefined,
            loading:
                firebaseUser === undefined || Boolean(firebaseUser && profileLoading),
            refreshProfile,
            logout
        }),
        [firebaseUser, profile, profileError, refreshProfile, logout]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) throw new Error("useAuth must be used inside AuthProvider");
    return context;
}

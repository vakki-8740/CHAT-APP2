import { Navigate, Outlet } from "react-router-dom";
import { LogOut, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { LoadingScreen } from "./LoadingScreen";
import { BottomNav } from "./BottomNav";
import { ErrorState } from "./ErrorState";

export function ProtectedLayout() {
    const { firebaseUser, loading, profileError, refreshProfile, logout } = useAuth();

    if (loading) return <LoadingScreen label="Signing you in…" />;
    if (!firebaseUser) return <Navigate to="/login" replace />;

    if (profileError) {
        return (
            <div className="app-frame">
                <div className="mx-auto max-w-md">
                    <ErrorState
                        title="Profile unavailable"
                        message={profileError}
                        onRetry={refreshProfile}
                        retryLabel="Reload profile"
                    />
                    <div className="flex justify-center">
                        <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
                            <LogOut className="size-4" /> Sign out
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <Outlet />;
}

export function TabLayout() {
    return (
        <div className="app-frame pb-24">
            <Outlet />
            <BottomNav />
        </div>
    );
}

export function RetryHint({ onRetry }) {
    return (
        <button type="button" className="btn btn-outline btn-sm" onClick={onRetry}>
            <RefreshCw className="size-3.5" /> Retry
        </button>
    );
}

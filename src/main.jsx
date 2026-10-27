import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/manrope/wght.css";
import "@fontsource-variable/dm-sans/wght.css";
import "@fontsource-variable/lora/wght.css";
import "@fontsource-variable/source-serif-4/wght.css";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { LoadingScreen } from "./components/LoadingScreen";
import { isAdminApp } from "./config/env";
import { installSoundUnlock, preloadSounds } from "./utils/sounds";
import "./index.css";

const AdminApp = lazy(() => import("./admin/AdminApp"));

if (!isAdminApp) {
    preloadSounds();
    installSoundUnlock();
}

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ErrorBoundary>
            {isAdminApp ? (
                <Suspense fallback={<LoadingScreen label="Loading Admin Vault…" />}>
                    <AdminApp />
                </Suspense>
            ) : (
                <App />
            )}
        </ErrorBoundary>
    </StrictMode>
);

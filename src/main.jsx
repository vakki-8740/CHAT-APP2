import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { installSoundUnlock, preloadSounds } from "./utils/sounds";
import "./index.css";

preloadSounds();
installSoundUnlock();

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ErrorBoundary>
            <App />
        </ErrorBoundary>
    </StrictMode>
);

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
    if (command === "build") {
        const env = loadEnv(mode, process.cwd(), "");
        const projectId = String(env.VITE_FIREBASE_PROJECT_ID || "").trim();
        const usesEmulators = String(env.VITE_USE_FIREBASE_EMULATORS || "").trim() === "true";
        const missing = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"]
            .filter((key) => !String(env[key] || "").trim());

        if (missing.length || projectId.startsWith("demo-") || usesEmulators) {
            throw new Error(
                [
                    "Production build blocked: local or incomplete Firebase configuration.",
                    missing.length ? `Missing: ${missing.join(", ")}.` : "",
                    projectId.startsWith("demo-")
                        ? "Remove the demo project from .env.local (it overrides .env)."
                        : "",
                    usesEmulators ? "VITE_USE_FIREBASE_EMULATORS must not be enabled." : "",
                    "Move .env.local away, fill real values in .env, then run the build again."
                ]
                    .filter(Boolean)
                    .join(" ")
            );
        }
    }

    return {
        base: "/",
        plugins: [react()],
        css: {
            transformer: "postcss"
        },
        build: {
            cssMinify: false
        },
        server: {
            host: "0.0.0.0",
            port: 5173
        }
    };
});

import { Readable } from "node:stream";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const API_ROUTES = {
    "/api/video-upload": () => import("./api/video-upload.js"),
    "/api/video-finalize": () => import("./api/video-finalize.js"),
    "/api/video-stream": () => import("./api/video-stream.js"),
    "/api/video-status": () => import("./api/video-status.js"),
    "/api/telegram-config": () => import("./api/telegram-config.js"),
    "/api/telegram-unlock": () => import("./api/telegram-unlock.js")
};

function localVideoApiPlugin() {
    const attach = (middlewares) => {
        middlewares.use(async (req, res, next) => {
            const rawUrl = req.url || "";
            const pathname = rawUrl.split("?")[0];
            const loader = API_ROUTES[pathname];
            if (!loader) {
                next();
                return;
            }
            try {
                const mod = await loader();
                const proto = req.headers["x-forwarded-proto"] || "http";
                const host = req.headers.host || "localhost:5173";
                const fullUrl = `${proto}://${host}${rawUrl}`;
                const headers = new Headers();
                for (const [k, v] of Object.entries(req.headers)) {
                    if (Array.isArray(v)) headers.set(k, v.join(", "));
                    else if (typeof v === "string") headers.set(k, v);
                }

                let body;
                if (req.method !== "GET" && req.method !== "HEAD") {
                    const chunks = [];
                    for await (const chunk of req) chunks.push(chunk);
                    body = Buffer.concat(chunks);
                }

                const webReq = new Request(fullUrl, {
                    method: req.method,
                    headers,
                    body
                });

                const webRes = await mod.default(webReq);
                res.statusCode = webRes.status;
                webRes.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                });

                if (!webRes.body || req.method === "HEAD") {
                    res.end();
                    return;
                }
                Readable.fromWeb(webRes.body).pipe(res);
            } catch (error) {
                res.statusCode = 500;
                res.setHeader("Content-Type", "application/json");
                res.end(
                    JSON.stringify({
                        error: error?.message || "Internal API error"
                    })
                );
            }
        });
    };

    return {
        name: "local-video-api",
        configureServer(server) {
            attach(server.middlewares);
        },
        configurePreviewServer(server) {
            attach(server.middlewares);
        }
    };
}

export default defineConfig(({ command, mode }) => {
    const loadedEnv = loadEnv(mode, process.cwd(), "");
    for (const [k, v] of Object.entries(loadedEnv)) {
        if (process.env[k] === undefined) process.env[k] = v;
    }

    if (command === "build") {
        const projectId = String(loadedEnv.VITE_FIREBASE_PROJECT_ID || "").trim();
        const usesEmulators = String(loadedEnv.VITE_USE_FIREBASE_EMULATORS || "").trim() === "true";
        const missing = ["VITE_FIREBASE_API_KEY", "VITE_FIREBASE_PROJECT_ID", "VITE_FIREBASE_APP_ID"]
            .filter((key) => !String(loadedEnv[key] || "").trim());

        if (missing.length || projectId.startsWith("demo-") || usesEmulators) {
            throw new Error(
                [
                    "Production build blocked: local or incomplete Firebase configuration.",
                    missing.length ? `Missing: ${missing.join(", ")}.` : "",
                    projectId.startsWith("demo-")
                        ? "Remove the demo project from .env.local (it overrides .env)."
                        : "",
                    usesEmulators ? "VITE_USE_FIREBASE_EMULATORS must not be enabled." : "",
                    "Add real VITE_FIREBASE_* environment variables in your hosting provider (Vercel/Netlify/etc.) or .env, then redeploy.",
                    "If .env.local exists locally, move it away: it overrides .env and the demo project."
                ]
                    .filter(Boolean)
                    .join(" ")
            );
        }
    }

    return {
        base: "/",
        plugins: [react(), localVideoApiPlugin()],
        css: {
            transformer: "postcss"
        },
        build: {
            cssMinify: false
        },
        server: {
            host: "0.0.0.0",
            port: 5173,
            allowedHosts: true
        },
        preview: {
            host: "0.0.0.0",
            port: 4173,
            allowedHosts: true
        }
    };
});

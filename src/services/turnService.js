import { auth } from "./firebase";
import { stunIceServers } from "../config/call";

function normalizeIceServer(server) {
    const rawUrls = Array.isArray(server?.urls)
        ? server.urls
        : server?.url
          ? [server.url]
          : [];
    const urls = rawUrls.filter(
        (url) =>
            typeof url === "string" &&
            /^(stun|stuns|turn|turns):/i.test(url.trim())
    );
    if (!urls.length) return null;

    const normalized = { urls };
    if (typeof server.username === "string") normalized.username = server.username;
    if (typeof server.credential === "string") normalized.credential = server.credential;
    if (typeof server.credentialType === "string") {
        normalized.credentialType = server.credentialType;
    }
    return normalized;
}

export async function getCallIceConfiguration() {
    const fallback = {
        iceServers: stunIceServers,
        turnConfigured: false,
        warning: "TURN credentials could not be loaded."
    };
    const currentUser = auth?.currentUser;
    if (!currentUser) return fallback;

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch("/api/turn-credentials", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${idToken}`,
                "Content-Type": "application/json"
            },
            body: "{}",
            cache: "no-store"
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            return {
                ...fallback,
                warning: String(payload?.error || fallback.warning)
            };
        }

        const turnServers = (Array.isArray(payload?.iceServers)
            ? payload.iceServers
            : [])
            .map(normalizeIceServer)
            .filter(Boolean);
        const hasTurnUrl = turnServers.some((server) =>
            server.urls.some((url) => /^turns?:/i.test(url))
        );
        if (!hasTurnUrl) {
            return {
                ...fallback,
                warning: String(payload?.error || "The TURN provider returned no relay servers.")
            };
        }

        return {
            iceServers: [...stunIceServers, ...turnServers],
            turnConfigured: true,
            warning: ""
        };
    } catch {
        return fallback;
    }
}

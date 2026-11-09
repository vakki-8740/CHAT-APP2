import { jsonResponse, readEnv, verifyFirebaseUser } from "./_lib/videoBackend.js";

const TURN_TOKEN_TTL_SECONDS = 3600;
const REQUEST_COOLDOWN_MS = 5000;
const lastIssuedAtByUid = new Map();

function normalizeIceServers(items) {
    if (!Array.isArray(items)) return [];
    return items
        .map((server) => {
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

            const isTurn = urls.some((url) => /^turns?:/i.test(url));
            const username = String(server?.username || "");
            const credential = String(server?.credential || "");
            if (isTurn && (!username || !credential)) return null;

            return {
                urls,
                ...(username ? { username } : {}),
                ...(credential ? { credential } : {}),
                ...(server?.credentialType === "oauth"
                    ? { credentialType: "oauth" }
                    : {})
            };
        })
        .filter(Boolean);
}

export const config = { runtime: "edge" };

export default async function handler(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204 });
    }
    if (request.method !== "POST") {
        return jsonResponse(405, { error: "Method not allowed." });
    }

    const user = await verifyFirebaseUser(request);
    if (!user?.uid) {
        return jsonResponse(401, { error: "Sign in before starting a call." });
    }

    const accountSid = readEnv("TWILIO_ACCOUNT_SID");
    const apiKeySid = readEnv("TWILIO_API_KEY_SID");
    const apiKeySecret = readEnv("TWILIO_API_KEY_SECRET");
    if (!accountSid || !apiKeySid || !apiKeySecret) {
        return jsonResponse(503, {
            error: "The server-side TURN provider is not configured yet."
        });
    }

    const now = Date.now();
    const lastIssuedAt = lastIssuedAtByUid.get(user.uid) || 0;
    if (now - lastIssuedAt < REQUEST_COOLDOWN_MS) {
        return jsonResponse(429, {
            error: "Please wait a moment before requesting call connection credentials again."
        });
    }
    lastIssuedAtByUid.set(user.uid, now);
    if (lastIssuedAtByUid.size > 2000) {
        for (const [uid, issuedAt] of lastIssuedAtByUid) {
            if (now - issuedAt > 60_000) lastIssuedAtByUid.delete(uid);
        }
    }

    try {
        const authorization = btoa(`${apiKeySid}:${apiKeySecret}`);
        const response = await fetch(
            `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Tokens.json`,
            {
                method: "POST",
                headers: {
                    Authorization: `Basic ${authorization}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: new URLSearchParams({ Ttl: String(TURN_TOKEN_TTL_SECONDS) }),
                cache: "no-store"
            }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
            console.error("Twilio could not issue temporary TURN credentials.", {
                status: response.status,
                code: payload?.code
            });
            return jsonResponse(502, {
                error: "The TURN provider could not issue temporary call credentials. Check the server-side Twilio settings."
            });
        }

        const iceServers = normalizeIceServers(payload?.ice_servers);
        const hasTurn = iceServers.some((server) =>
            server.urls.some((url) => /^turns?:/i.test(url))
        );
        if (!hasTurn) {
            return jsonResponse(502, {
                error: "The TURN provider returned no usable relay servers."
            });
        }

        return jsonResponse(200, {
            iceServers,
            expiresInSeconds: TURN_TOKEN_TTL_SECONDS
        });
    } catch (error) {
        console.error("Could not contact the TURN provider.", error);
        return jsonResponse(502, {
            error: "Could not contact the TURN provider. Please try the call again."
        });
    }
}

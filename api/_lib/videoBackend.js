export const VIDEO_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

const DEFAULT_FIREBASE_API_KEY = "AIzaSyC6_0uY7LVReJOWqs_zu_G2S-b-Ogs2FaA";
const DEFAULT_FIREBASE_PROJECT_ID = "chat-app2-5cd36";
const DEFAULT_GDRIVE_FOLDER_ID = "1x_9dCsqU0rRaA99jQ0FQpmCxI5AG9gkt";

const VIDEO_MIME_BY_EXT = {
    mp4: "video/mp4",
    m4v: "video/x-m4v",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska",
    "3gp": "video/3gpp",
    "3g2": "video/3gpp2",
    ogv: "video/ogg",
    avi: "video/x-msvideo",
    mpeg: "video/mpeg",
    mpg: "video/mpeg"
};

const ALLOWED_VIDEO_MIMES = new Map([
    ["video/mp4", "mp4"],
    ["video/x-m4v", "m4v"],
    ["video/quicktime", "mov"],
    ["video/webm", "webm"],
    ["video/x-matroska", "mkv"],
    ["video/3gpp", "3gp"],
    ["video/3gpp2", "3g2"],
    ["video/ogg", "ogv"],
    ["video/x-msvideo", "avi"],
    ["video/mpeg", "mpeg"]
]);

let cachedDriveToken = { token: "", expiresAt: 0, folderName: "" };
let cachedFirestoreScript = { url: "", fetchedAt: 0 };

export function readEnv(key, fallback = "") {
    const val = globalThis.process?.env?.[key];
    return typeof val === "string" && val.trim() ? val.trim() : fallback;
}

export function getFolderId() {
    return readEnv("GDRIVE_FOLDER_ID", DEFAULT_GDRIVE_FOLDER_ID);
}

export function getSigningSecret() {
    return readEnv(
        "VIDEO_SIGNING_SECRET",
        "chat-app2-video-stream-default-hmac-key-2026-permanent"
    );
}

export function getBridgeSecret() {
    return readEnv("GDRIVE_BRIDGE_SECRET", "");
}

export function corsHeaders(origin = "*") {
    return {
        "Access-Control-Allow-Origin": origin || "*",
        "Access-Control-Allow-Methods": "GET, HEAD, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Authorization, Content-Type, Range",
        "Access-Control-Expose-Headers":
            "Content-Length, Content-Range, Accept-Ranges, Content-Type",
        "Cache-Control": "no-store"
    };
}

export function jsonResponse(status, body, extraHeaders = {}) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json; charset=utf-8",
            "X-Content-Type-Options": "nosniff",
            ...corsHeaders("*"),
            ...extraHeaders
        }
    });
}

export function extractBearerToken(request) {
    const header = request.headers.get("authorization") || "";
    const match = header.match(/^Bearer\s+(.+)$/i);
    return match ? match[1].trim() : "";
}

export async function verifyFirebaseUser(request) {
    const idToken = extractBearerToken(request);
    if (!idToken) return null;

    const apiKey = readEnv("VITE_FIREBASE_API_KEY", DEFAULT_FIREBASE_API_KEY);
    try {
        const res = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ idToken })
            }
        );
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        const user = data?.users?.[0];
        if (!user?.localId) return null;
        return {
            uid: String(user.localId),
            email: String(user.email || "").toLowerCase()
        };
    } catch {
        return null;
    }
}

export function isAuthorizedForChat(user, chatKey) {
    if (!user?.uid) return false;
    const key = String(chatKey || "").trim();
    if (!/^[A-Za-z0-9_-]{2,200}$/.test(key)) return false;
    if (user.email === "admin@chat.local") return true;
    const parts = key.split("_");
    if (parts.length !== 2 || parts[0] === parts[1]) return false;
    return parts.includes(user.uid);
}

export function resolveVideoMime(rawMime, fileName = "") {
    const cleaned = String(rawMime || "")
        .split(";")[0]
        .trim()
        .toLowerCase();
    if (ALLOWED_VIDEO_MIMES.has(cleaned)) {
        return { mimeType: cleaned, ext: ALLOWED_VIDEO_MIMES.get(cleaned) };
    }
    const ext = String(fileName || "")
        .split(".")
        .pop()
        .trim()
        .toLowerCase();
    const mapped = VIDEO_MIME_BY_EXT[ext];
    if (mapped) {
        return { mimeType: mapped, ext };
    }
    return null;
}

export function sanitizeDriveFileName(fileName, ext, chatKey) {
    const base = String(fileName || "video")
        .replace(/\.[^.]+$/, "")
        .replace(/[^A-Za-z0-9_-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    return `${stamp}_${chatKey}_${base || "video"}.${ext}`;
}

export async function signVideoId(fileId) {
    const secret = getSigningSecret();
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(fileId));
    return Array.from(new Uint8Array(signature))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function verifyVideoSignature(fileId, providedSig) {
    const sig = String(providedSig || "").trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(sig)) return false;
    const expected = await signVideoId(fileId);
    if (expected.length !== sig.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i += 1) {
        diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
    }
    return diff === 0;
}

export function isValidAppsScriptUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/i.test(
        String(url || "").trim()
    );
}

async function readScriptUrlFromFirestore(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && cachedFirestoreScript.fetchedAt > 0 && now - cachedFirestoreScript.fetchedAt < 45_000) {
        return cachedFirestoreScript.url;
    }
    const projectId = readEnv("VITE_FIREBASE_PROJECT_ID", DEFAULT_FIREBASE_PROJECT_ID);
    try {
        const res = await fetch(
            `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/appSettings/videoDrive`
        );
        if (!res.ok) {
            cachedFirestoreScript = { url: "", fetchedAt: now };
            return "";
        }
        const doc = await res.json().catch(() => null);
        const url = String(doc?.fields?.scriptUrl?.stringValue || "").trim();
        const validUrl = isValidAppsScriptUrl(url) ? url : "";
        cachedFirestoreScript = { url: validUrl, fetchedAt: now };
        return validUrl;
    } catch {
        return "";
    }
}

async function postAppsScript(url, payload) {
    let res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        redirect: "manual"
    });

    let hops = 0;
    while ([301, 302, 303, 307, 308].includes(res.status) && hops < 4) {
        const location = res.headers.get("location");
        if (!location) break;
        res = await fetch(location, {
            method: res.status === 307 || res.status === 308 ? "POST" : "GET",
            headers:
                res.status === 307 || res.status === 308
                    ? { "Content-Type": "application/json" }
                    : undefined,
            body:
                res.status === 307 || res.status === 308
                    ? JSON.stringify(payload)
                    : undefined,
            redirect: "manual"
        });
        hops += 1;
    }

    if (!res.ok) {
        throw new Error(`Google Drive bridge returned HTTP ${res.status}.`);
    }
    const data = await res.json().catch(() => null);
    if (!data?.ok || !data?.accessToken) {
        throw new Error(data?.error || "Invalid response from Google Drive bridge.");
    }
    return data;
}

export async function getGoogleDriveAccessToken({
    forceRefresh = false,
    overrideScriptUrl = ""
} = {}) {
    const now = Date.now();
    if (
        !forceRefresh &&
        !overrideScriptUrl &&
        cachedDriveToken.token &&
        cachedDriveToken.expiresAt > now + 60_000
    ) {
        return cachedDriveToken;
    }

    // Mode 1: Direct OAuth2 refresh token if configured
    const clientId = readEnv("GDRIVE_CLIENT_ID");
    const clientSecret = readEnv("GDRIVE_CLIENT_SECRET");
    const refreshToken = readEnv("GDRIVE_REFRESH_TOKEN");

    if (!overrideScriptUrl && clientId && clientSecret && refreshToken) {
        const form = new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: refreshToken,
            grant_type: "refresh_token"
        });
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: form.toString()
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.access_token) {
            throw new Error(
                data.error_description || data.error || "Failed to refresh Google Drive OAuth token."
            );
        }
        const expiresInMs = Math.max(300, Number(data.expires_in || 3500) - 120) * 1000;
        cachedDriveToken = {
            token: data.access_token,
            expiresAt: now + expiresInMs,
            folderName: "CHAT-APP2 Videos"
        };
        return cachedDriveToken;
    }

    // Mode 2: Permanent Google Apps Script Web App bridge
    const envScriptUrl = readEnv("GDRIVE_SCRIPT_URL");
    const scriptUrl =
        overrideScriptUrl ||
        (isValidAppsScriptUrl(envScriptUrl) ? envScriptUrl : "") ||
        (await readScriptUrlFromFirestore(forceRefresh));

    if (!scriptUrl) {
        const notConfigured = new Error(
            "Google Drive video storage is not connected yet. Open Admin Panel → Videos tab to finish the 1-minute setup."
        );
        notConfigured.code = "gdrive/not-configured";
        throw notConfigured;
    }

    if (!isValidAppsScriptUrl(scriptUrl)) {
        throw new Error(
            "Invalid Google Apps Script Web App URL. It must end with /exec."
        );
    }

    const bridgeSecret = getBridgeSecret();
    const folderId = getFolderId();
    const bridgeData = await postAppsScript(scriptUrl, {
        secret: bridgeSecret,
        folderId,
        action: "token"
    });

    const next = {
        token: String(bridgeData.accessToken),
        expiresAt: now + 45 * 60 * 1000,
        folderName: String(bridgeData.folderName || "CHAT-APP2 Videos")
    };
    if (!overrideScriptUrl) {
        cachedDriveToken = next;
    }
    return next;
}

export function buildAppsScriptSnippet() {
    const bridgeSecret = getBridgeSecret();
    const folderId = getFolderId();
    return [
        "// Personal Chat (CHAT-APP2) — Permanent Google Drive 200 MB Video Bridge",
        "// Steps:",
        "// 1. Open https://script.google.com -> New project -> paste this code & Save",
        "// 2. Click Deploy -> New deployment -> Select type: Web app",
        "// 3. Execute as: Me | Who has access: Anyone -> Click Deploy & Authorize",
        "// 4. Copy the Web app URL (ending in /exec) and paste it in Admin Panel -> Videos",
        "",
        `const BRIDGE_SECRET = ${JSON.stringify(bridgeSecret)};`,
        `const FOLDER_ID = ${JSON.stringify(folderId)};`,
        "",
        "function doPost(e) {",
        "  try {",
        '    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");',
        "    if (BRIDGE_SECRET && body.secret !== BRIDGE_SECRET) {",
        '      return jsonOut({ ok: false, error: "Unauthorized secret." });',
        "    }",
        "    const folder = DriveApp.getFolderById(body.folderId || FOLDER_ID);",
        "    return jsonOut({",
        "      ok: true,",
        "      accessToken: ScriptApp.getOAuthToken(),",
        "      folderId: folder.getId(),",
        "      folderName: folder.getName()",
        "    });",
        "  } catch (err) {",
        "    return jsonOut({ ok: false, error: String(err && err.message ? err.message : err) });",
        "  }",
        "}",
        "",
        "function jsonOut(payload) {",
        "  return ContentService",
        "    .createTextOutput(JSON.stringify(payload))",
        "    .setMimeType(ContentService.MimeType.JSON);",
        "}",
        "",
        "// Requests full Drive upload + streaming scope during deployment authorization:",
        "function _authorizeDriveScope_() {",
        '  DriveApp.createFile("_scope", "");',
        "}"
    ].join("\n");
}

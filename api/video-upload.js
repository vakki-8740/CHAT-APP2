import {
    VIDEO_MAX_BYTES,
    corsHeaders,
    getFolderId,
    getGoogleDriveAccessToken,
    isAuthorizedForChat,
    jsonResponse,
    resolveVideoMime,
    sanitizeDriveFileName,
    verifyFirebaseUser
} from "./_lib/videoBackend.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders("*") });
    }
    if (request.method !== "POST") {
        return jsonResponse(405, { error: "Method not allowed." });
    }

    const user = await verifyFirebaseUser(request);
    if (!user) {
        return jsonResponse(401, {
            error: "Your session expired. Sign in again to upload videos."
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: "Invalid JSON payload." });
    }

    const chatKey = String(body?.chatKey || "").trim();
    if (!isAuthorizedForChat(user, chatKey)) {
        return jsonResponse(403, {
            error: "You are not a participant in this video conversation."
        });
    }

    const size = Number(body?.size || 0);
    if (!Number.isFinite(size) || size <= 0) {
        return jsonResponse(400, { error: "Selected video file is empty." });
    }
    if (size > VIDEO_MAX_BYTES) {
        return jsonResponse(413, {
            error: "Video is too large. Maximum allowed size is 200 MB."
        });
    }

    const resolved = resolveVideoMime(body?.mimeType, body?.fileName);
    if (!resolved) {
        return jsonResponse(415, {
            error: "Unsupported video format. Please choose MP4, MOV, WebM, MKV, M4V, or 3GP."
        });
    }

    let driveAuth;
    try {
        driveAuth = await getGoogleDriveAccessToken();
    } catch (error) {
        const status = error?.code === "gdrive/not-configured" ? 503 : 502;
        return jsonResponse(status, {
            error: error?.message || "Could not connect to Google Drive storage."
        });
    }

    const clientOrigin =
        request.headers.get("origin") ||
        String(body?.origin || "").trim() ||
        new URL(request.url).origin;

    const folderId = getFolderId();
    const driveFileName = sanitizeDriveFileName(body?.fileName, resolved.ext, chatKey);

    const initiateSession = async (token) =>
        fetch(
            "https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,mimeType,size",
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json; charset=UTF-8",
                    Origin: clientOrigin,
                    "X-Upload-Content-Type": resolved.mimeType,
                    "X-Upload-Content-Length": String(Math.floor(size))
                },
                body: JSON.stringify({
                    name: driveFileName,
                    parents: [folderId],
                    description: `Personal Chat Video Pack (${chatKey})`
                })
            }
        );

    let initRes = await initiateSession(driveAuth.token);
    if (initRes.status === 401) {
        try {
            driveAuth = await getGoogleDriveAccessToken({ forceRefresh: true });
            initRes = await initiateSession(driveAuth.token);
        } catch {
            /* handled below */
        }
    }

    if (!initRes.ok) {
        const errPayload = await initRes.json().catch(() => ({}));
        const detail =
            errPayload?.error?.message ||
            `Google Drive rejected upload session (${initRes.status}).`;
        return jsonResponse(502, { error: detail });
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) {
        return jsonResponse(502, {
            error: "Google Drive did not return a resumable upload URL."
        });
    }

    return jsonResponse(200, {
        uploadUrl,
        mimeType: resolved.mimeType,
        folderId
    });
}

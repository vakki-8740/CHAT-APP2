import {
    VIDEO_MAX_BYTES,
    corsHeaders,
    getFolderId,
    getGoogleDriveAccessToken,
    isAuthorizedForChat,
    jsonResponse,
    signVideoId,
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
            error: "Your session expired. Sign in again to complete upload."
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

    const driveFileId = String(body?.driveFileId || "").trim();
    if (!/^[A-Za-z0-9_-]{10,80}$/.test(driveFileId)) {
        return jsonResponse(400, { error: "Invalid Google Drive file ID." });
    }

    let driveAuth;
    try {
        driveAuth = await getGoogleDriveAccessToken();
    } catch (error) {
        return jsonResponse(502, {
            error: error?.message || "Could not verify uploaded file on Google Drive."
        });
    }

    const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?supportsAllDrives=true&fields=id,name,mimeType,size,parents,trashed`,
        {
            headers: { Authorization: `Bearer ${driveAuth.token}` }
        }
    );

    if (!metaRes.ok) {
        return jsonResponse(404, {
            error: "Uploaded video could not be verified in Google Drive."
        });
    }

    const meta = await metaRes.json().catch(() => ({}));
    if (meta.trashed) {
        return jsonResponse(400, { error: "Uploaded file was trashed." });
    }

    const folderId = getFolderId();
    if (Array.isArray(meta.parents) && !meta.parents.includes(folderId)) {
        return jsonResponse(403, {
            error: "Uploaded file is not inside the authorized video folder."
        });
    }

    const actualSize = Number(meta.size || 0);
    if (actualSize > VIDEO_MAX_BYTES) {
        await fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?supportsAllDrives=true`,
            {
                method: "DELETE",
                headers: { Authorization: `Bearer ${driveAuth.token}` }
            }
        ).catch(() => {});
        return jsonResponse(413, {
            error: "Uploaded video exceeded the 200 MB limit and was rejected."
        });
    }

    const signature = await signVideoId(driveFileId);
    const streamPath = `/api/video-stream?id=${encodeURIComponent(driveFileId)}&s=${signature}`;

    return jsonResponse(200, {
        url: streamPath,
        driveFileId,
        signature,
        mimeType: String(meta.mimeType || "video/mp4"),
        size: actualSize
    });
}

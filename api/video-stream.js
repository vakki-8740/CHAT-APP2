import {
    corsHeaders,
    getGoogleDriveAccessToken,
    jsonResponse,
    verifyVideoSignature
} from "./_lib/videoBackend.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders("*") });
    }
    if (request.method !== "GET" && request.method !== "HEAD") {
        return jsonResponse(405, { error: "Method not allowed." });
    }

    const url = new URL(request.url);
    const fileId = String(url.searchParams.get("id") || "").trim();
    const sig = String(url.searchParams.get("s") || "").trim();
    const forceDownload = url.searchParams.get("download") === "1";
    const downloadName = String(url.searchParams.get("name") || `video-${fileId}.mp4`)
        .replace(/[^A-Za-z0-9._-]+/g, "-")
        .slice(0, 80);

    if (!/^[A-Za-z0-9_-]{10,80}$/.test(fileId)) {
        return jsonResponse(400, { error: "Invalid video ID." });
    }

    const valid = await verifyVideoSignature(fileId, sig);
    if (!valid) {
        return jsonResponse(403, { error: "Invalid video signature." });
    }

    let driveAuth;
    try {
        driveAuth = await getGoogleDriveAccessToken();
    } catch (error) {
        return jsonResponse(503, {
            error: error?.message || "Video storage is temporarily unavailable."
        });
    }

    const range = request.headers.get("range") || "";

    const fetchDriveMedia = async (token) => {
        const upstreamHeaders = { Authorization: `Bearer ${token}` };
        if (range) upstreamHeaders.Range = range;
        return fetch(
            `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
            {
                method: "GET",
                headers: upstreamHeaders
            }
        );
    };

    let upstream = await fetchDriveMedia(driveAuth.token);
    if (upstream.status === 401) {
        try {
            driveAuth = await getGoogleDriveAccessToken({ forceRefresh: true });
            upstream = await fetchDriveMedia(driveAuth.token);
        } catch {
            /* handled below */
        }
    }

    if (!upstream.ok && upstream.status !== 206) {
        return jsonResponse(upstream.status === 404 ? 404 : 502, {
            error:
                upstream.status === 404
                    ? "Video file not found in Google Drive."
                    : `Could not stream video (${upstream.status}).`
        });
    }

    const headers = new Headers(corsHeaders("*"));
    const contentType = upstream.headers.get("content-type") || "video/mp4";
    headers.set("Content-Type", contentType);
    headers.set("Accept-Ranges", "bytes");
    headers.set("Cache-Control", "private, max-age=86400");
    headers.set("X-Content-Type-Options", "nosniff");

    const contentLength = upstream.headers.get("content-length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const contentRange = upstream.headers.get("content-range");
    if (contentRange) headers.set("Content-Range", contentRange);

    headers.set(
        "Content-Disposition",
        forceDownload
            ? `attachment; filename="${downloadName || "video.mp4"}"`
            : `inline; filename="${downloadName || "video.mp4"}"`
    );

    if (request.method === "HEAD") {
        upstream.body?.cancel?.().catch?.(() => {});
        return new Response(null, { status: upstream.status, headers });
    }

    return new Response(upstream.body, {
        status: upstream.status,
        headers
    });
}

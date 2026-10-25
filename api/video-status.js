import {
    VIDEO_MAX_BYTES,
    buildAppsScriptSnippet,
    corsHeaders,
    getFolderId,
    getGoogleDriveAccessToken,
    isValidAppsScriptUrl,
    jsonResponse,
    readEnv,
    verifyFirebaseUser
} from "./_lib/videoBackend.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders("*") });
    }
    if (request.method !== "GET" && request.method !== "POST") {
        return jsonResponse(405, { error: "Method not allowed." });
    }

    const user = await verifyFirebaseUser(request);
    if (!user || user.email !== "admin@chat.local") {
        return jsonResponse(403, { error: "Admin authentication required." });
    }

    let testScriptUrl = "";
    if (request.method === "POST") {
        const body = await request.json().catch(() => ({}));
        testScriptUrl = String(body?.scriptUrl || "").trim();
        if (testScriptUrl && !isValidAppsScriptUrl(testScriptUrl)) {
            return jsonResponse(400, {
                connected: false,
                error: "URL must be a valid Google Apps Script Web App URL ending with /exec."
            });
        }
    }

    const folderId = getFolderId();
    const scriptCode = buildAppsScriptSnippet();
    const envScriptUrl = readEnv("GDRIVE_SCRIPT_URL");

    try {
        const tokenInfo = await getGoogleDriveAccessToken({
            forceRefresh: true,
            overrideScriptUrl: testScriptUrl
        });
        return jsonResponse(200, {
            connected: true,
            folderId,
            folderName: tokenInfo.folderName || "CHAT-APP2 Videos",
            folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
            maxMegabytes: Math.round(VIDEO_MAX_BYTES / (1024 * 1024)),
            hasEnvScriptUrl: Boolean(envScriptUrl),
            scriptCode
        });
    } catch (error) {
        return jsonResponse(200, {
            connected: false,
            folderId,
            folderUrl: `https://drive.google.com/drive/folders/${folderId}`,
            maxMegabytes: Math.round(VIDEO_MAX_BYTES / (1024 * 1024)),
            hasEnvScriptUrl: Boolean(envScriptUrl),
            error: error?.message || "Google Drive is not connected yet.",
            scriptCode
        });
    }
}

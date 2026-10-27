import {
    corsHeaders,
    jsonResponse,
    verifyFirebaseUser
} from "./_lib/videoBackend.js";
import {
    REACTION_TELEGRAM_TEXT,
    readTelegramConfig,
    sendTelegramMessage
} from "./_lib/telegramBackend.js";

export const config = { runtime: "edge" };

export default async function handler(request) {
    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders("*") });
    }
    if (request.method !== "POST") {
        return jsonResponse(405, { error: "Method not allowed." });
    }

    const user = await verifyFirebaseUser(request);
    if (!user?.uid) {
        return jsonResponse(403, { error: "User authentication required." });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: "Invalid JSON payload." });
    }

    const emoji = String(body?.emoji || "").trim().slice(0, 32);
    if (!emoji) {
        return jsonResponse(400, { error: "A reaction emoji is required." });
    }

    const configData = await readTelegramConfig();
    if (!configData.configured || !configData.botToken || !configData.chatId) {
        return jsonResponse(200, { ok: false, skipped: "not-configured" });
    }

    try {
        await sendTelegramMessage({
            botToken: configData.botToken,
            chatId: configData.chatId,
            text: `${REACTION_TELEGRAM_TEXT} ${emoji}`
        });
        return jsonResponse(200, { ok: true });
    } catch {
        return jsonResponse(200, { ok: false, skipped: "send-failed" });
    }
}

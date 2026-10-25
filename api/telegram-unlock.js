import { corsHeaders, jsonResponse } from "./_lib/videoBackend.js";
import {
    APP_LOCK_PIN,
    UNLOCK_TELEGRAM_TEXT,
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

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: "Invalid JSON payload." });
    }

    const pin = String(body?.pin || "").trim();
    if (pin !== APP_LOCK_PIN) {
        return jsonResponse(403, { error: "Unauthorized unlock pin." });
    }

    const configData = await readTelegramConfig();
    if (!configData.configured || !configData.botToken || !configData.chatId) {
        return jsonResponse(200, { ok: false, skipped: "not-configured" });
    }

    try {
        await sendTelegramMessage({
            botToken: configData.botToken,
            chatId: configData.chatId,
            text: UNLOCK_TELEGRAM_TEXT
        });
        return jsonResponse(200, { ok: true });
    } catch {
        return jsonResponse(200, { ok: false, skipped: "send-failed" });
    }
}

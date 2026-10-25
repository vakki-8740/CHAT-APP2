import {
    corsHeaders,
    extractBearerToken,
    jsonResponse,
    verifyFirebaseUser
} from "./_lib/videoBackend.js";
import {
    UNLOCK_TELEGRAM_TEXT,
    normalizeBotToken,
    normalizeChatId,
    readTelegramConfig,
    sendTelegramMessage,
    verifyTelegramBot,
    writeTelegramConfig
} from "./_lib/telegramBackend.js";

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

    if (request.method === "GET") {
        const current = await readTelegramConfig();
        let botUsername = "";
        if (current.configured && current.botToken) {
            try {
                const info = await verifyTelegramBot(current.botToken);
                botUsername = info.username || "";
            } catch {
                /* ignore getMe network/token warning on read */
            }
        }
        return jsonResponse(200, {
            configured: current.configured,
            botToken: current.botToken,
            chatId: current.chatId,
            botUsername,
            updatedAt: current.updatedAt,
            unlockMessage: UNLOCK_TELEGRAM_TEXT
        });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return jsonResponse(400, { error: "Invalid JSON payload." });
    }

    const action = String(body?.action || "save").trim().toLowerCase();
    const rawToken = String(body?.botToken || "").trim();
    const rawChatId = String(body?.chatId || "").trim();

    if (action === "test" && !rawToken && !rawChatId) {
        const saved = await readTelegramConfig();
        if (!saved.configured) {
            return jsonResponse(400, {
                error: "Pehle Bot Token aur Chat ID daal kar Save karein."
            });
        }
        try {
            await sendTelegramMessage({
                botToken: saved.botToken,
                chatId: saved.chatId,
                text: UNLOCK_TELEGRAM_TEXT
            });
            return jsonResponse(200, {
                ok: true,
                message: "Test message Telegram channel me bhej diya gaya!"
            });
        } catch (error) {
            return jsonResponse(400, {
                error: error?.message || "Could not send Telegram test message."
            });
        }
    }

    const tokenCheck = normalizeBotToken(rawToken);
    if (!tokenCheck.ok) {
        return jsonResponse(400, { error: tokenCheck.error });
    }

    const chatCheck = normalizeChatId(rawChatId);
    if (!chatCheck.ok) {
        return jsonResponse(400, { error: chatCheck.error });
    }

    let botInfo;
    try {
        botInfo = await verifyTelegramBot(tokenCheck.value);
    } catch (error) {
        return jsonResponse(400, {
            error: error?.message || "Could not verify Telegram Bot Token."
        });
    }

    if (action === "test") {
        try {
            await sendTelegramMessage({
                botToken: tokenCheck.value,
                chatId: chatCheck.value,
                text: UNLOCK_TELEGRAM_TEXT
            });
            return jsonResponse(200, {
                ok: true,
                botUsername: botInfo.username,
                message: "Test message Telegram channel me bhej diya gaya!"
            });
        } catch (error) {
            return jsonResponse(400, {
                error: error?.message || "Could not send Telegram test message."
            });
        }
    }

    // Save & Update action
    const adminIdToken = extractBearerToken(request);
    try {
        const saved = await writeTelegramConfig({
            botToken: tokenCheck.value,
            chatId: chatCheck.value,
            adminIdToken
        });
        return jsonResponse(200, {
            ok: true,
            configured: true,
            botToken: tokenCheck.value,
            chatId: chatCheck.value,
            botUsername: botInfo.username || "",
            updatedAt: saved.updatedAt,
            unlockMessage: UNLOCK_TELEGRAM_TEXT
        });
    } catch (error) {
        return jsonResponse(error?.status || 500, {
            error: error?.message || "Could not save Telegram configuration."
        });
    }
}

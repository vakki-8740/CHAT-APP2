import { getSigningSecret, readEnv } from "./videoBackend.js";

export const UNLOCK_TELEGRAM_TEXT = "User Online aaya hai 😁✳️✅";
export const CHAT_TELEGRAM_TEXT = "message received 💬";
export const APP_LOCK_PIN = "272026";

const DEFAULT_FIREBASE_PROJECT_ID = "chat-app2-5cd36";

function bytesToBase64Url(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(b64url) {
    const padded = String(b64url || "")
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(String(b64url || "").length / 4) * 4, "=");
    const binary = atob(padded);
    const out = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        out[i] = binary.charCodeAt(i);
    }
    return out;
}

async function deriveAesKey() {
    const secret = `telegram-vault:${getSigningSecret()}`;
    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(secret)
    );
    return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt"
    ]);
}

export async function encryptTelegramSecrets({ botToken, chatId }) {
    const key = await deriveAesKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(
        JSON.stringify({ botToken, chatId })
    );
    const ciphertext = new Uint8Array(
        await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plaintext)
    );
    return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(ciphertext)}`;
}

export async function decryptTelegramSecrets(blob) {
    const parts = String(blob || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== "v1") return null;
    try {
        const key = await deriveAesKey();
        const iv = base64UrlToBytes(parts[1]);
        const ciphertext = base64UrlToBytes(parts[2]);
        const plainBuffer = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            ciphertext
        );
        const parsed = JSON.parse(new TextDecoder().decode(plainBuffer));
        if (!parsed?.botToken || !parsed?.chatId) return null;
        return {
            botToken: String(parsed.botToken),
            chatId: String(parsed.chatId)
        };
    } catch {
        return null;
    }
}

export function normalizeBotToken(raw) {
    let val = String(raw || "").trim();
    const urlMatch = val.match(/api\.telegram\.org\/bot([^/\s]+)/i);
    if (urlMatch) val = urlMatch[1];
    const botPrefixMatch = val.match(/^bot(\d{5,20}:[A-Za-z0-9_-]{20,120})$/i);
    if (botPrefixMatch) val = botPrefixMatch[1];
    if (!/^\d{5,20}:[A-Za-z0-9_-]{20,120}$/.test(val)) {
        return { ok: false, value: "", error: "Invalid Telegram Bot Token format (example: 123456789:ABCdef...)." };
    }
    return { ok: true, value: val, error: "" };
}

export function normalizeChatId(raw) {
    let val = String(raw || "").trim();
    if (!val) {
        return { ok: false, value: "", error: "Telegram Channel / Chat ID is required." };
    }
    const inviteMatch = val.match(/^https?:\/\/t\.me\/(?:\+|joinchat\/)/i);
    if (inviteMatch) {
        return {
            ok: false,
            value: "",
            error: "Private invite link ki jagah Channel ka numeric Chat ID (-100...) dalein."
        };
    }
    const publicLinkMatch = val.match(/^https?:\/\/t\.me\/([A-Za-z0-9_]{4,64})\/?$/i);
    if (publicLinkMatch) {
        val = `@${publicLinkMatch[1]}`;
    }
    if (/^-?\d{5,22}$/.test(val) || /^@[A-Za-z0-9_]{4,64}$/.test(val)) {
        return { ok: true, value: val, error: "" };
    }
    return {
        ok: false,
        value: "",
        error: "Valid Chat ID dalein (jaise -1001234567890 ya @channel_username)."
    };
}

function firestoreDocUrl() {
    const projectId = readEnv("VITE_FIREBASE_PROJECT_ID", DEFAULT_FIREBASE_PROJECT_ID);
    return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/appSettings/telegramAlert`;
}

export async function readTelegramConfig() {
    try {
        const res = await fetch(firestoreDocUrl(), {
            headers: { Accept: "application/json" }
        });
        if (res.ok) {
            const doc = await res.json().catch(() => null);
            const encrypted = String(doc?.fields?.encrypted?.stringValue || "").trim();
            const updatedAt = String(doc?.fields?.updatedAt?.stringValue || "").trim();
            if (encrypted) {
                const decrypted = await decryptTelegramSecrets(encrypted);
                if (decrypted?.botToken && decrypted?.chatId) {
                    return {
                        configured: true,
                        botToken: decrypted.botToken,
                        chatId: decrypted.chatId,
                        updatedAt
                    };
                }
            }
        }
    } catch {
        /* fall back to env if present */
    }

    const envToken = readEnv("TELEGRAM_BOT_TOKEN");
    const envChat = readEnv("TELEGRAM_CHAT_ID");
    if (envToken && envChat) {
        return {
            configured: true,
            botToken: envToken,
            chatId: envChat,
            updatedAt: ""
        };
    }

    return {
        configured: false,
        botToken: "",
        chatId: "",
        updatedAt: ""
    };
}

export async function writeTelegramConfig({ botToken, chatId, adminIdToken }) {
    const encrypted = await encryptTelegramSecrets({ botToken, chatId });
    const updatedAt = new Date().toISOString();

    const res = await fetch(firestoreDocUrl(), {
        method: "PATCH",
        headers: {
            Authorization: `Bearer ${adminIdToken}`,
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        body: JSON.stringify({
            fields: {
                encrypted: { stringValue: encrypted },
                updatedAt: { stringValue: updatedAt }
            }
        })
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const status = res.status;
        if (status === 403) {
            const permErr = new Error(
                "Firestore Rules update zaroori hai: upar 'Copy Firestore Rules' daba kar Firebase Console → Firestore Database → Rules me Publish karein, fir Save dabayein."
            );
            permErr.status = 403;
            throw permErr;
        }
        throw new Error(
            err?.error?.message || `Could not save Telegram config (${status}).`
        );
    }

    return { updatedAt };
}

export async function verifyTelegramBot(botToken) {
    let res;
    try {
        res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    } catch {
        throw new Error("Could not connect to Telegram API.");
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
        throw new Error(
            "Bot Token sahi nahi hai. @BotFather se sahi Bot Token copy karke dalein."
        );
    }
    return {
        id: data.result?.id,
        username: data.result?.username || "",
        firstName: data.result?.first_name || "Bot"
    };
}

export async function sendTelegramMessage({ botToken, chatId, text = UNLOCK_TELEGRAM_TEXT }) {
    let res;
    try {
        res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                disable_web_page_preview: true
            })
        });
    } catch {
        throw new Error("Could not reach Telegram servers.");
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
        const desc = String(data?.description || "");
        if (res.status === 401 || /unauthorized/i.test(desc)) {
            throw new Error("Bot Token galat ya revoke ho chuka hai.");
        }
        if (/chat not found/i.test(desc)) {
            throw new Error(
                "Chat ID nahi mila! Pehle apne Bot ko Telegram Channel me Admin banayein aur sahi Chat ID (-100... ya @channel) dalein."
            );
        }
        if (/administrator rights|not a member|forbidden|have no rights/i.test(desc)) {
            throw new Error(
                "Bot ko Telegram Channel me Admin (Post Messages permission ke saath) add karein."
            );
        }
        throw new Error(desc || `Telegram API error (${res.status}).`);
    }

    return {
        ok: true,
        messageId: data.result?.message_id || null
    };
}

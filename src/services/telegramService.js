import { auth } from "./firebase";

/**
 * Fires a non-blocking server request as soon as a user unlocks LockPage so
 * the configured Telegram Channel receives: "User Online aaya hai 😁✳️✅".
 *
 * Uses `keepalive: true` so the request always completes even while LockPage
 * unmounts and the main app router mounts.
 */
export function notifyUserUnlocked(pin) {
    try {
        fetch("/api/telegram-unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: String(pin || "") }),
            keepalive: true
        }).catch(() => {
            /* Silent background notification */
        });
    } catch {
        /* Silent background notification */
    }
}

/**
 * Notification in Telegram: fires a non-blocking server request whenever ANY
 * user sends ANY kind of chat (text, image, voice pack, or video pack) so the
 * configured Telegram Channel receives: "message received 💬".
 */
export function notifyReactionAdded({ emoji, collectionName = "chats" } = {}) {
    Promise.resolve()
        .then(async () => {
            const idToken = await auth?.currentUser?.getIdToken().catch(() => "");
            if (!idToken) return;
            await fetch("/api/telegram-reaction", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    emoji: String(emoji || "").slice(0, 32),
                    collectionName: String(collectionName || "chats")
                }),
                keepalive: true
            });
        })
        .catch(() => {
            /* Silent background notification */
        });
}

export function notifyChatSent({ type = "text", collectionName = "chats" } = {}) {
    Promise.resolve()
        .then(async () => {
            const idToken = await auth?.currentUser?.getIdToken().catch(() => "");
            if (!idToken) return;
            await fetch("/api/telegram-chat", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${idToken}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    type: String(type || "text"),
                    collectionName: String(collectionName || "chats")
                }),
                keepalive: true
            });
        })
        .catch(() => {
            /* Silent background notification */
        });
}

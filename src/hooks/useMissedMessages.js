import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { userService } from "../services/userService";
import {
    THREAD_KINDS,
    collectMissedMessages,
    groupMissedMessages
} from "../services/missedMessagesService";

/**
 * Drives the "Offline Missed Messages" popup on the Home Page.
 *
 * Behaviour:
 *   - The popup is evaluated ONCE per browser session, the first time the Home
 *     Page is mounted with a signed-in user. That is exactly the moment a user
 *     "comes back online and opens the app", which is what the feature asks for.
 *   - Messages that arrive later, while the user is actively in the app, do not
 *     re-open the popup. They keep flowing through the existing live chat system
 *     untouched (unread badge + notification sound), so nothing feels hijacked.
 *   - Dismissing the popup does NOT mark anything as read. Unread badges are
 *     cleared only by the existing chatService.markRead() when a conversation is
 *     actually opened.
 */

const SHOWN_KEY = "missedMessagesPopupShown";
/** Let the server snapshot land after the cached one before deciding. */
const SETTLE_MS = 700;

function alreadyShownThisSession() {
    try {
        return window.sessionStorage.getItem(SHOWN_KEY) === "1";
    } catch {
        // Storage blocked (private mode, embedded browser): never nag the user.
        return true;
    }
}

function rememberShownThisSession() {
    try {
        window.sessionStorage.setItem(SHOWN_KEY, "1");
    } catch {
        /* ignore */
    }
}

export function useMissedMessages() {
    const { uid } = useAuth();

    // Decided once per hook instance so remounting (Home -> Chat -> Home) does
    // not re-run the whole collection pass.
    const skipRef = useRef(null);
    if (skipRef.current === null) skipRef.current = alreadyShownThisSession();

    const [chatsByKind, setChatsByKind] = useState({});
    const [readyCount, setReadyCount] = useState(0);
    const [messages, setMessages] = useState([]);
    const [profiles, setProfiles] = useState({});
    const [loading, setLoading] = useState(false);
    const [visible, setVisible] = useState(false);

    const decidedRef = useRef(false);
    const runRef = useRef(0);
    const readyRef = useRef(new Set());

    /* ---- listen to the three thread collections ---- */
    useEffect(() => {
        if (!uid || skipRef.current) return undefined;

        readyRef.current = new Set();
        setReadyCount(0);
        setChatsByKind({});

        const markReady = (key) => {
            readyRef.current.add(key);
            setReadyCount(readyRef.current.size);
        };

        const stops = THREAD_KINDS.map((kind) =>
            kind.service.subscribeChats(
                uid,
                (list) => {
                    setChatsByKind((prev) => ({ ...prev, [kind.key]: list }));
                    markReady(kind.key);
                },
                () => {
                    // An unreadable/unused pack must not block the popup forever.
                    markReady(kind.key);
                }
            )
        );

        return () => {
            for (const stop of stops) {
                if (typeof stop === "function") stop();
            }
        };
    }, [uid]);

    /* ---- decide once, after every collection has reported in ---- */
    useEffect(() => {
        if (!uid || skipRef.current || decidedRef.current) return undefined;
        if (readyCount < THREAD_KINDS.length) return undefined;

        decidedRef.current = true;
        const runId = runRef.current + 1;
        runRef.current = runId;

        const timer = window.setTimeout(() => {
            (async () => {
                setLoading(true);
                try {
                    const list = await collectMissedMessages({ uid, chatsByKind });
                    if (runId !== runRef.current) return;
                    setMessages(list);

                    if (list.length === 0) {
                        rememberShownThisSession();
                        return;
                    }

                    const peerUids = [...new Set(list.map((message) => message.peerUid))];
                    const fetched = await Promise.all(
                        peerUids.map(async (peerUid) => {
                            try {
                                return [peerUid, await userService.getProfile(peerUid)];
                            } catch {
                                return [peerUid, null];
                            }
                        })
                    );
                    if (runId !== runRef.current) return;
                    setProfiles(Object.fromEntries(fetched));

                    if (!alreadyShownThisSession()) {
                        setVisible(true);
                        rememberShownThisSession();
                    }
                } finally {
                    if (runId === runRef.current) setLoading(false);
                }
            })();
        }, SETTLE_MS);

        return () => window.clearTimeout(timer);
        // chatsByKind is intentionally read at decision time only; re-running on
        // every live chat update would defeat the "decide once" behaviour.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [uid, readyCount]);

    const groups = useMemo(
        () =>
            groupMissedMessages(messages).map((group) => ({
                ...group,
                profile: profiles[group.peerUid] || null
            })),
        [messages, profiles]
    );

    const dismiss = useCallback(() => {
        setVisible(false);
        rememberShownThisSession();
    }, []);

    const counts = useMemo(() => {
        const byType = {};
        for (const message of messages) {
            byType[message.type] = (byType[message.type] || 0) + 1;
        }
        return {
            total: messages.length,
            people: groups.length,
            byType
        };
    }, [messages, groups]);

    return { groups, counts, visible, loading, dismiss };
}

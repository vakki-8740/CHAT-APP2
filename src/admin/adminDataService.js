import { useCallback, useEffect, useMemo, useState } from "react";
import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "../services/firebase";
import { toDate } from "../utils/format";

const THREAD_MESSAGES_LIMIT = 300;
const VAULT_LIMIT = 1000;
const CALLS_LIMIT = 250;

function stampMs(value) {
    const date = toDate(value);
    return date ? date.getTime() : 0;
}

function isPermissionDenied(error) {
    const code = String(error?.code || "");
    return code.includes("permission-denied") || /insufficient permissions/i.test(String(error?.message || ""));
}

export function useAdminData(enabled) {
    const [users, setUsers] = useState([]);
    const [chats, setChats] = useState([]);
    const [chatMessagesMap, setChatMessagesMap] = useState({});
    const [voiceChats, setVoiceChats] = useState([]);
    const [voiceMessagesMap, setVoiceMessagesMap] = useState({});
    const [calls, setCalls] = useState([]);
    const [vaultItems, setVaultItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [permissionIssues, setPermissionIssues] = useState({});
    const [reloadTick, setReloadTick] = useState(0);

    const reload = useCallback(() => {
        setPermissionIssues({});
        setReloadTick((v) => v + 1);
    }, []);

    useEffect(() => {
        if (!enabled || !isFirebaseConfigured || !db) {
            setLoading(false);
            return undefined;
        }

        let active = true;
        let usersLoaded = false;
        let chatsLoaded = false;
        setLoading(true);

        const markReady = () => {
            if (active && usersLoaded && chatsLoaded) setLoading(false);
        };

        const flagError = (scope, error) => {
            if (!active) return;
            if (isPermissionDenied(error)) {
                setPermissionIssues((prev) => ({ ...prev, [scope]: true }));
            }
        };

        const unsubUsers = onSnapshot(
            query(collection(db, "users"), orderBy("displayName")),
            (snap) => {
                if (!active) return;
                setUsers(snap.docs.map((d) => ({ uid: d.id, ...d.data() })));
                usersLoaded = true;
                setPermissionIssues((prev) => ({ ...prev, users: false }));
                markReady();
            },
            (err) => {
                usersLoaded = true;
                flagError("users", err);
                markReady();
            }
        );

        const unsubChats = onSnapshot(
            collection(db, "chats"),
            (snap) => {
                if (!active) return;
                setChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                chatsLoaded = true;
                setPermissionIssues((prev) => ({ ...prev, chats: false }));
                markReady();
            },
            (err) => {
                chatsLoaded = true;
                flagError("chats", err);
                markReady();
            }
        );

        const unsubVoiceChats = onSnapshot(
            collection(db, "voiceChats"),
            (snap) => {
                if (!active) return;
                setVoiceChats(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setPermissionIssues((prev) => ({ ...prev, voiceChats: false }));
            },
            (err) => flagError("voiceChats", err)
        );

        const unsubCalls = onSnapshot(
            query(collection(db, "calls"), orderBy("createdAt", "desc"), limit(CALLS_LIMIT)),
            (snap) => {
                if (!active) return;
                setCalls(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setPermissionIssues((prev) => ({ ...prev, calls: false }));
            },
            (err) => flagError("calls", err)
        );

        const unsubVault = onSnapshot(
            query(collection(db, "adminVault"), orderBy("createdAt", "desc"), limit(VAULT_LIMIT)),
            (snap) => {
                if (!active) return;
                setVaultItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
                setPermissionIssues((prev) => ({ ...prev, adminVault: false }));
            },
            (err) => flagError("adminVault", err)
        );

        return () => {
            active = false;
            unsubUsers();
            unsubChats();
            unsubVoiceChats();
            unsubCalls();
            unsubVault();
        };
    }, [enabled, reloadTick]);

    const chatIdsKey = useMemo(
        () => chats.map((c) => c.id).sort().join("|"),
        [chats]
    );

    useEffect(() => {
        if (!enabled || !isFirebaseConfigured || !db || !chatIdsKey) {
            setChatMessagesMap({});
            return undefined;
        }
        const ids = chatIdsKey.split("|").filter(Boolean);
        let active = true;
        const unsubs = ids.map((chatId) =>
            onSnapshot(
                query(
                    collection(db, "chats", chatId, "messages"),
                    orderBy("createdAt", "desc"),
                    limit(THREAD_MESSAGES_LIMIT)
                ),
                (snap) => {
                    if (!active) return;
                    const list = snap.docs
                        .map((d) => ({ id: d.id, chatId, ...d.data() }))
                        .reverse();
                    setChatMessagesMap((prev) => ({ ...prev, [chatId]: list }));
                },
                () => {}
            )
        );
        return () => {
            active = false;
            unsubs.forEach((fn) => fn());
        };
    }, [enabled, chatIdsKey, reloadTick]);

    const voiceIdsKey = useMemo(
        () => voiceChats.map((c) => c.id).sort().join("|"),
        [voiceChats]
    );

    useEffect(() => {
        if (!enabled || !isFirebaseConfigured || !db || !voiceIdsKey) {
            setVoiceMessagesMap({});
            return undefined;
        }
        const ids = voiceIdsKey.split("|").filter(Boolean);
        let active = true;
        const unsubs = ids.map((chatId) =>
            onSnapshot(
                query(
                    collection(db, "voiceChats", chatId, "messages"),
                    orderBy("createdAt", "desc"),
                    limit(THREAD_MESSAGES_LIMIT)
                ),
                (snap) => {
                    if (!active) return;
                    const list = snap.docs
                        .map((d) => ({ id: d.id, chatId, ...d.data() }))
                        .reverse();
                    setVoiceMessagesMap((prev) => ({ ...prev, [chatId]: list }));
                },
                () => {}
            )
        );
        return () => {
            active = false;
            unsubs.forEach((fn) => fn());
        };
    }, [enabled, voiceIdsKey, reloadTick]);

    const usersById = useMemo(() => {
        const map = new Map();
        for (const item of vaultItems) {
            if (item.kind === "profile_snapshot" && item.uid && !map.has(item.uid)) {
                map.set(item.uid, {
                    uid: item.uid,
                    displayName: item.displayName || "User",
                    mobileNumber: item.mobileNumber || "",
                    photoURL: item.photoURL || "",
                    bio: item.bio || ""
                });
            }
        }
        for (const user of users) {
            map.set(user.uid, user);
        }
        return map;
    }, [users, vaultItems]);

    const vaultIndex = useMemo(() => {
        const byMessageKey = new Map();
        const editsByMessageKey = new Map();

        for (const item of vaultItems) {
            if (item.kind === "chat_message" || item.kind === "voice_message") {
                const key = `${item.collectionName}:${item.chatId}:${item.messageId}`;
                if (!byMessageKey.has(key)) byMessageKey.set(key, item);
            } else if (item.kind === "message_edit") {
                const key = `${item.collectionName}:${item.chatId}:${item.messageId}`;
                const list = editsByMessageKey.get(key) || [];
                list.push(item);
                editsByMessageKey.set(key, list);
            }
        }
        return { byMessageKey, editsByMessageKey };
    }, [vaultItems]);

    const mergedChatThreads = useMemo(() => {
        const threadMap = new Map();
        for (const chat of chats) {
            threadMap.set(chat.id, { ...chat, messages: [] });
        }

        for (const [chatId, list] of Object.entries(chatMessagesMap)) {
            if (!threadMap.has(chatId)) {
                threadMap.set(chatId, {
                    id: chatId,
                    participants: chatId.split("_"),
                    messages: []
                });
            }
            const thread = threadMap.get(chatId);
            const seenIds = new Set();

            for (const msg of list) {
                seenIds.add(msg.id);
                const key = `chats:${chatId}:${msg.id}`;
                const vaulted = vaultIndex.byMessageKey.get(key);
                const edits = vaultIndex.editsByMessageKey.get(key) || [];
                const deleted = Boolean(msg.deletedForEveryone);

                thread.messages.push({
                    ...msg,
                    chatId,
                    text: deleted && vaulted?.text ? vaulted.text : msg.text,
                    originalText:
                        vaulted?.text && vaulted.text !== msg.text ? vaulted.text : "",
                    imageUrl:
                        deleted && vaulted?.imageUrl ? vaulted.imageUrl : msg.imageUrl,
                    preservedFromVault: Boolean(
                        deleted && (vaulted?.text || vaulted?.imageUrl)
                    ),
                    editHistoryCount: edits.length
                });
            }

            for (const item of vaultItems) {
                if (
                    item.kind === "chat_message" &&
                    item.chatId === chatId &&
                    !seenIds.has(item.messageId)
                ) {
                    thread.messages.push({
                        id: item.messageId,
                        chatId,
                        senderId: item.senderId,
                        type: item.type,
                        text: item.text || "",
                        imageUrl: item.imageUrl || "",
                        replyTo: item.replyTo || null,
                        createdAt: item.createdAt,
                        deletedForEveryone: true,
                        preservedFromVault: true
                    });
                }
            }

            thread.messages.sort((a, b) => stampMs(a.createdAt) - stampMs(b.createdAt));
        }

        for (const item of vaultItems) {
            if (item.kind === "chat_message" && item.chatId && !threadMap.has(item.chatId)) {
                threadMap.set(item.chatId, {
                    id: item.chatId,
                    participants:
                        item.participants?.length === 2
                            ? item.participants
                            : item.chatId.split("_"),
                    updatedAt: item.createdAt,
                    messages: [
                        {
                            id: item.messageId,
                            chatId: item.chatId,
                            senderId: item.senderId,
                            type: item.type,
                            text: item.text || "",
                            imageUrl: item.imageUrl || "",
                            replyTo: item.replyTo || null,
                            createdAt: item.createdAt,
                            preservedFromVault: true
                        }
                    ]
                });
            }
        }

        return Array.from(threadMap.values()).sort((a, b) => {
            const aLast =
                stampMs(a.updatedAt) ||
                stampMs(a.messages[a.messages.length - 1]?.createdAt);
            const bLast =
                stampMs(b.updatedAt) ||
                stampMs(b.messages[b.messages.length - 1]?.createdAt);
            return bLast - aLast;
        });
    }, [chats, chatMessagesMap, vaultIndex, vaultItems]);

    const mergedVoicePacks = useMemo(() => {
        const items = [];
        const seenKeys = new Set();

        for (const [chatId, list] of Object.entries(voiceMessagesMap)) {
            const thread = voiceChats.find((v) => v.id === chatId);
            const participants = thread?.participants || chatId.split("_");

            for (const msg of list) {
                const key = `voiceChats:${chatId}:${msg.id}`;
                seenKeys.add(key);
                const vaulted = vaultIndex.byMessageKey.get(key);
                const deleted = Boolean(msg.deletedForEveryone);
                const receiverId =
                    participants.find((p) => p !== msg.senderId) || participants[0] || "";

                items.push({
                    ...msg,
                    chatId,
                    receiverId,
                    audioUrl:
                        deleted && vaulted?.audioUrl ? vaulted.audioUrl : msg.audioUrl,
                    duration:
                        deleted && vaulted?.duration ? vaulted.duration : msg.duration,
                    preservedFromVault: Boolean(deleted && vaulted?.audioUrl)
                });
            }
        }

        for (const item of vaultItems) {
            if (item.kind !== "voice_message") continue;
            const key = `voiceChats:${item.chatId}:${item.messageId}`;
            if (seenKeys.has(key)) continue;
            seenKeys.add(key);
            items.push({
                id: item.messageId,
                chatId: item.chatId,
                senderId: item.senderId,
                receiverId: item.receiverId,
                type: "voice",
                audioUrl: item.audioUrl || "",
                duration: item.duration || 0,
                replyTo: item.replyTo || null,
                createdAt: item.createdAt,
                deletedForEveryone: true,
                preservedFromVault: true
            });
        }

        return items.sort((a, b) => stampMs(b.createdAt) - stampMs(a.createdAt));
    }, [voiceChats, voiceMessagesMap, vaultIndex, vaultItems]);

    const allImages = useMemo(() => {
        const list = [];

        for (const thread of mergedChatThreads) {
            const participants = thread.participants || thread.id.split("_");
            for (const msg of thread.messages) {
                if (msg.type === "image" && msg.imageUrl) {
                    const receiverId =
                        participants.find((p) => p !== msg.senderId) ||
                        participants[0] ||
                        "";
                    list.push({
                        id: `chatimg_${thread.id}_${msg.id}`,
                        source: "chat",
                        url: msg.imageUrl,
                        senderId: msg.senderId,
                        receiverId,
                        chatId: thread.id,
                        createdAt: msg.createdAt,
                        deletedInChat: Boolean(msg.deletedForEveryone),
                        preservedFromVault: Boolean(msg.preservedFromVault)
                    });
                }
            }
        }

        for (const user of users) {
            if (user.photoURL) {
                list.push({
                    id: `avatar_${user.uid}`,
                    source: "profile",
                    url: user.photoURL,
                    senderId: user.uid,
                    receiverId: "",
                    chatId: "",
                    createdAt: user.updatedAt || user.createdAt,
                    deletedInChat: false,
                    preservedFromVault: false
                });
            }
        }

        return list.sort((a, b) => stampMs(b.createdAt) - stampMs(a.createdAt));
    }, [mergedChatThreads, users]);

    const totalTextMessages = useMemo(
        () =>
            mergedChatThreads.reduce(
                (sum, thread) => sum + thread.messages.length,
                0
            ),
        [mergedChatThreads]
    );

    const rulesNeedSync = Boolean(
        permissionIssues.chats ||
            permissionIssues.voiceChats ||
            permissionIssues.adminVault
    );

    return {
        users,
        usersById,
        chatThreads: mergedChatThreads,
        voicePacks: mergedVoicePacks,
        allImages,
        calls,
        vaultItems,
        totalTextMessages,
        loading,
        permissionIssues,
        rulesNeedSync,
        reload
    };
}

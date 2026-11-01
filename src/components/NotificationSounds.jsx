import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Volume2, X } from "lucide-react";
import { Avatar } from "./Avatar";
import { chatService } from "../services/chatService";
import { voiceService } from "../services/voiceService";
import { videoService } from "../services/videoService";
import { reactionNotificationService } from "../services/reactionNotificationService";
import { userService } from "../services/userService";
import { playSound } from "../utils/sounds";

const THREADS = [
    {
        service: chatService,
        type: "chat",
        collectionName: "chats",
        route: "/chat",
        sound: "messageReceived"
    },
    {
        service: voiceService,
        type: "voice",
        collectionName: "voiceChats",
        route: "/voice",
        sound: "voiceReceived"
    },
    {
        service: videoService,
        type: "video",
        collectionName: "videoChats",
        route: "/video",
        sound: "messageReceived"
    }
];

function previewFor(lastMessage, threadType) {
    if (threadType === "voice" || lastMessage?.type === "voice") return "Sent a voice message";
    if (threadType === "video" || lastMessage?.type === "video") return "Sent a video";
    if (lastMessage?.type === "image") return "Sent a photo";
    return String(lastMessage?.text || "Sent you a message").trim().slice(0, 90);
}

function collectIncoming(list, seen, ready, uid, thread) {
    const incoming = [];
    for (const chat of list) {
        const last = chat.lastMessage;
        if (!last) {
            seen.set(chat.id, null);
            continue;
        }

        const previousMessageId = seen.get(chat.id);
        seen.set(chat.id, last.id || null);
        if (!ready || last.senderId === uid || !last.id || last.id === previousMessageId) {
            continue;
        }

        const otherUid = chat.participants?.find((participant) => participant !== uid);
        if (!otherUid) continue;
        incoming.push({
            id: `${thread.type}-${chat.id}-${last.id}`,
            otherUid,
            route: `${thread.route}/${otherUid}`,
            threadType: thread.type,
            kind: "message",
            preview: previewFor(last, thread.type)
        });
    }
    return incoming;
}

export function NotificationSounds({ uid }) {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);

    const dismiss = useCallback((id) => {
        setNotifications((current) => current.filter((item) => item.id !== id));
    }, []);

    useEffect(() => {
        if (!uid) return undefined;

        let active = true;
        let reactionNotificationsInitialized = false;
        const initializedThreads = new Map(THREADS.map((thread) => [thread.type, false]));
        const seenMessagesByType = new Map(
            THREADS.map((thread) => [thread.type, new Map()])
        );
        const seenReactionNotificationIds = new Set();
        const profilesByUid = new Map();

        const getProfile = (userId) => {
            if (!profilesByUid.has(userId)) {
                profilesByUid.set(userId, userService.getProfile(userId).catch(() => null));
            }
            return profilesByUid.get(userId);
        };

        const enqueueWithProfile = (item, sound) => {
            playSound(sound);
            getProfile(item.otherUid).then((sender) => {
                if (!active) return;
                setNotifications((current) => [
                    ...current,
                    {
                        ...item,
                        senderName: sender?.displayName || "New message",
                        senderPhotoURL: sender?.photoURL || ""
                    }
                ]);
                window.setTimeout(() => dismiss(item.id), 7000);
            });
        };

        const unsubscribers = THREADS.map((thread) =>
            thread.service.subscribeChats(
                uid,
                (list, meta) => {
                    if (!active || meta?.fromCache) return;
                    const ready = initializedThreads.get(thread.type);
                    initializedThreads.set(thread.type, true);
                    const received = collectIncoming(
                        list,
                        seenMessagesByType.get(thread.type),
                        ready,
                        uid,
                        thread
                    );
                    received.forEach((item) => enqueueWithProfile(item, thread.sound));
                },
                () => {}
            )
        );

        const stopReactionNotifications = reactionNotificationService.subscribe(
            uid,
            (items, meta) => {
                if (!active || meta?.fromCache) return;

                if (!reactionNotificationsInitialized) {
                    items.forEach((item) => seenReactionNotificationIds.add(item.id));
                    reactionNotificationsInitialized = true;
                    return;
                }

                const newItems = [];
                for (const item of items) {
                    if (seenReactionNotificationIds.has(item.id)) continue;
                    seenReactionNotificationIds.add(item.id);
                    const thread = THREADS.find(
                        (candidate) => candidate.collectionName === item.collectionName
                    );
                    if (!thread || item.receiverUid !== uid || !item.senderUid) continue;
                    newItems.push({
                        id: `reaction-${item.id}`,
                        otherUid: item.senderUid,
                        route: `${thread.route}/${item.senderUid}`,
                        threadType: thread.type,
                        kind: "reaction",
                        preview: `${item.emoji || "💬"} reacted to your message`
                    });
                }

                newItems.forEach((item) =>
                    enqueueWithProfile(
                        item,
                        item.threadType === "voice" ? "voiceReceived" : "messageReceived"
                    )
                );
            },
            () => {}
        );

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
            stopReactionNotifications();
        };
    }, [uid, dismiss]);

    if (!notifications.length) return null;

    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-3 z-[95] flex flex-col items-center gap-2 px-3"
            role="status"
            aria-live="polite"
        >
            {notifications.map((item) => (
                <div
                    key={item.id}
                    className="animate-fade-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-card"
                >
                    <Avatar
                        name={item.senderName}
                        src={item.senderPhotoURL}
                        uid={item.otherUid}
                        size="md"
                    />
                    <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => {
                            dismiss(item.id);
                            navigate(item.route);
                        }}
                        aria-label={`Open ${item.kind} from ${item.senderName}`}
                    >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                            <span className="truncate">{item.senderName}</span>
                            <Volume2 className="size-3.5 shrink-0 text-accent" aria-label="Sound played" />
                        </span>
                        <span className="block truncate text-xs text-muted">{item.preview}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => dismiss(item.id)}
                        className="rounded-md p-1.5 text-muted hover:bg-soft hover:text-ink"
                        aria-label="Dismiss notification"
                    >
                        <X className="size-4" />
                    </button>
                </div>
            ))}
        </div>
    );
}

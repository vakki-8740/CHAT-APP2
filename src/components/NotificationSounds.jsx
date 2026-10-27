import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, MessageCircle, Video, Volume2, X } from "lucide-react";
import { chatService } from "../services/chatService";
import { voiceService } from "../services/voiceService";
import { videoService } from "../services/videoService";
import { userService } from "../services/userService";
import { playSound } from "../utils/sounds";

const THREADS = [
    { service: chatService, type: "chat", route: "/chat", sound: "messageReceived" },
    { service: voiceService, type: "voice", route: "/voice", sound: "voiceReceived" },
    { service: videoService, type: "video", route: "/video", sound: "messageReceived" }
];

function previewFor(lastMessage, threadType) {
    if (threadType === "voice" || lastMessage?.type === "voice") return "Sent a voice message";
    if (threadType === "video" || lastMessage?.type === "video") return "Sent a video";
    if (lastMessage?.type === "image") return "Sent a photo";
    return String(lastMessage?.text || "Sent you a message").trim().slice(0, 90);
}

function collectIncoming(list, seen, ready, uid, threadType) {
    const incoming = [];
    const route = THREADS.find((item) => item.type === threadType)?.route || "/chat";

    for (const chat of list) {
        const last = chat.lastMessage;
        if (!last) {
            seen.messages.delete(chat.id);
        } else {
            const previousMessageId = seen.messages.get(chat.id);
            seen.messages.set(chat.id, last.id || null);
            if (
                ready &&
                last.senderId !== uid &&
                last.id &&
                last.id !== previousMessageId
            ) {
                const otherUid = chat.participants?.find((participant) => participant !== uid);
                if (otherUid) {
                    incoming.push({
                        id: `${threadType}-${chat.id}-${last.id}`,
                        otherUid,
                        route: `${route}/${otherUid}`,
                        threadType,
                        kind: "message",
                        preview: previewFor(last, threadType)
                    });
                }
            }
        }

        const reaction = chat.lastReaction;
        const previousReactionId = seen.reactions.get(chat.id);
        seen.reactions.set(chat.id, reaction?.id || null);
        if (
            ready &&
            reaction?.id &&
            reaction.id !== previousReactionId &&
            reaction.receiverId === uid &&
            reaction.senderId !== uid
        ) {
            incoming.push({
                id: `reaction-${threadType}-${chat.id}-${reaction.id}`,
                otherUid: reaction.senderId,
                route: `${route}/${reaction.senderId}`,
                threadType,
                kind: "reaction",
                preview: `${reaction.emoji || "💬"} reacted to your message`
            });
        }
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
        const initialized = new Map(THREADS.map(({ type }) => [type, false]));
        const seenByType = new Map(
            THREADS.map(({ type }) => [type, { messages: new Map(), reactions: new Map() }])
        );
        const unsubscribers = THREADS.map(({ service, type, sound }) =>
            service.subscribeChats(
                uid,
                (list, meta) => {
                    if (!active || meta?.fromCache) return;
                    const ready = initialized.get(type);
                    initialized.set(type, true);
                    const received = collectIncoming(
                        list,
                        seenByType.get(type),
                        ready,
                        uid,
                        type
                    );
                    if (!received.length) return;

                    playSound(sound);
                    for (const item of received) {
                        userService
                            .getProfile(item.otherUid)
                            .catch(() => null)
                            .then((sender) => {
                                if (!active) return;
                                setNotifications((current) => [
                                    ...current.slice(-2),
                                    {
                                        ...item,
                                        senderName: sender?.displayName || "New message"
                                    }
                                ]);
                                window.setTimeout(() => dismiss(item.id), 7000);
                            });
                    }
                },
                () => {}
            )
        );

        return () => {
            active = false;
            unsubscribers.forEach((unsubscribe) => unsubscribe());
        };
    }, [uid, dismiss]);

    if (!notifications.length) return null;

    return (
        <div
            className="pointer-events-none fixed inset-x-0 top-3 z-[95] flex flex-col items-center gap-2 px-3"
            role="status"
            aria-live="polite"
        >
            {notifications.map((item) => {
                const Icon =
                    item.kind === "reaction"
                        ? Heart
                        : item.threadType === "video"
                          ? Video
                          : MessageCircle;
                return (
                    <div
                        key={item.id}
                        className="animate-fade-in pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-xl border border-line bg-card p-3 shadow-card"
                    >
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                            <Icon className="size-5" aria-hidden="true" />
                        </div>
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
                );
            })}
        </div>
    );
}

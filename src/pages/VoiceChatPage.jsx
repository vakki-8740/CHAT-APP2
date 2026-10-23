import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mic, Paperclip, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { ChatBubble } from "../components/ChatBubble";
import { VoiceRecorder } from "../components/VoiceRecorder";
import { MessageMenu } from "../components/MessageMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Spinner } from "../components/LoadingScreen";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useThread } from "../hooks/useThread";
import { voiceService } from "../services/voiceService";
import { makeChatId } from "../services/chatService";
import { userService, isOnline } from "../services/userService";
import { storageStatus, uploadFile } from "../services/storageAdapter";
import { validateFile } from "../utils/validation";
import { formatDayLabel, toDate } from "../utils/format";
import { getAudioDuration } from "../utils/files";

export default function VoiceChatPage() {
    const { uid: peerUid } = useParams();
    const { uid, profile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [peer, setPeer] = useState(null);
    const [peerError, setPeerError] = useState("");
    const { messages, loading, error, retry } = useThread(voiceService, uid, peerUid);

    const [replyTo, setReplyTo] = useState(null);
    const [menuMessage, setMenuMessage] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [pending, setPending] = useState([]);
    const [uploading, setUploading] = useState(false);

    const fileRef = useRef(null);
    const bottomRef = useRef(null);
    const previousCount = useRef(0);

    useEffect(() => {
        if (peerUid === uid) navigate("/voice", { replace: true });
    }, [peerUid, uid, navigate]);

    useEffect(() => {
        setPending([]);
        setReplyTo(null);
        setMenuMessage(null);
        setConfirm(null);
        previousCount.current = 0;
    }, [peerUid]);

    useEffect(() => {
        if (!peerUid) return undefined;
        setPeer(null);
        setPeerError("");
        return userService.subscribeProfile(peerUid, setPeer, (nextError) =>
            setPeerError(nextError.message)
        );
    }, [peerUid]);

    useEffect(() => {
        if (!uid || !peerUid) return;
        voiceService.resetUnread({ uid, otherUid: peerUid });
    }, [uid, peerUid, messages.length]);

    useEffect(() => {
        setPending((list) => {
            const keep = list.filter(
                (item) =>
                    !messages.some(
                        (message) => message.id === item.id && !message.pending
                    )
            );
            for (const item of list) {
                if (!keep.includes(item) && item._localUrl?.startsWith("blob:")) {
                    URL.revokeObjectURL(item._localUrl);
                }
            }
            return keep;
        });
    }, [messages]);

    useEffect(() => {
        if (loading) return;
        const total = messages.length + pending.length;
        if (total !== previousCount.current) {
            bottomRef.current?.scrollIntoView({
                block: "end",
                behavior: previousCount.current === 0 ? "auto" : "smooth"
            });
            previousCount.current = total;
        }
    }, [messages.length, pending.length, loading]);

    const visibleMessages = useMemo(
        () =>
            messages.filter(
                (message) =>
                    !(Array.isArray(message.hiddenFor) && message.hiddenFor.includes(uid)) &&
                    !pending.some((item) => item.id === message.id)
            ),
        [messages, uid, pending]
    );

    const combined = useMemo(() => {
        const list = [...visibleMessages];
        for (const item of pending) {
            if (!list.some((message) => message.id === item.id)) list.push(item);
        }
        return list;
    }, [visibleMessages, pending]);

    function resolveName(id) {
        if (id === uid) return profile?.displayName || "You";
        return peer?.displayName || "User";
    }

    async function sendVoice({ file, duration, messageId, localUrl }) {
        const status = storageStatus();
        if (!status.configured) {
            toast.error(status.message);
            return;
        }

        const id = messageId || voiceService.newMessageId(uid, peerUid);
        const local = localUrl || URL.createObjectURL(file);
        const message = {
            id,
            senderId: uid,
            type: "voice",
            text: "",
            audioUrl: local,
            duration: Number(duration) || 0,
            replyTo: replyTo || null,
            createdAt: new Date()
        };
        setReplyTo(null);
        setPending((list) => [
            ...list.filter((item) => item.id !== id),
            { ...message, status: "uploading", _file: file, _localUrl: local }
        ]);
        setUploading(true);

        try {
            let audioUrl = local;
            if (file) {
                const uploaded = await uploadFile(file, {
                    folder: `voiceNotes/${makeChatId(uid, peerUid)}`
                });
                audioUrl = uploaded.url;
            }
            setPending((list) =>
                list.map((item) =>
                    item.id === id ? { ...item, audioUrl, status: "sending" } : item
                )
            );
            await voiceService.sendMessage({
                uid,
                otherUid: peerUid,
                messageId: id,
                type: "voice",
                audioUrl,
                duration: message.duration,
                replyTo: message.replyTo
            });
            setPending((list) =>
                list.map((item) => (item.id === id ? { ...item, status: "sent" } : item))
            );
        } catch (nextError) {
            setPending((list) =>
                list.map((item) =>
                    item.id === id
                        ? { ...item, status: "failed", error: nextError.message }
                        : item
                )
            );
            toast.error(nextError.message || "Could not send the voice note.");
        } finally {
            setUploading(false);
        }
    }

    async function handleAudioFile(file) {
        const validation = validateFile(file, "audio");
        if (validation) {
            toast.error(validation);
            return;
        }
        const duration = await getAudioDuration(file);
        await sendVoice({ file, duration });
    }

    async function handleReact(message, emoji) {
        setMenuMessage(null);
        try {
            await voiceService.react({
                uid,
                otherUid: peerUid,
                messageId: message.id,
                emoji
            });
        } catch (nextError) {
            toast.error(nextError.message);
        }
    }

    function handleReply(message) {
        setMenuMessage(null);
        setReplyTo(message);
    }

    async function handleDelete() {
        if (!confirm) return;
        setConfirmBusy(true);
        try {
            if (confirm.scope === "everyone") {
                await voiceService.deleteForEveryone({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Deleted for everyone.");
            } else {
                await voiceService.deleteForMe({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Deleted for you.");
            }
            setConfirm(null);
        } catch (nextError) {
            toast.error(nextError.message);
        } finally {
            setConfirmBusy(false);
        }
    }

    if (error) {
        return (
            <div className="app-frame">
                <VoiceHeader peer={peer} online={false} subtitle="Voice Pack" />
                <ErrorState
                    title="Could not open this Voice Pack chat"
                    message={error}
                    onRetry={retry}
                    retryLabel="Try again"
                />
            </div>
        );
    }

    return (
        <div className="app-frame flex h-[100dvh] flex-col">
            <VoiceHeader
                peer={peer}
                online={isOnline(peer)}
                subtitle={
                    peerError ? "Profile unavailable" : peer ? "Voice messages only" : "Loading…"
                }
            />

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                        <Spinner className="size-4" /> Loading voice notes…
                    </div>
                ) : combined.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                            <Mic className="size-6" />
                        </span>
                        <p className="text-sm font-semibold">
                            No voice notes yet with {peer?.displayName || "this user"}
                        </p>
                        <p className="text-xs text-muted">
                            Tap the microphone to record, or attach an audio file.
                        </p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-2.5">
                            {combined.map((message, index) => {
                                const previous = combined[index - 1];
                                const currentDay = toDate(message.createdAt)?.toDateString();
                                const previousDay = toDate(previous?.createdAt)?.toDateString();
                                const showDay = index === 0 || currentDay !== previousDay;
                                return (
                                    <div key={message.id}>
                                        {showDay ? (
                                            <div className="my-3 flex justify-center">
                                                <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-muted shadow-sm">
                                                    {formatDayLabel(message.createdAt)}
                                                </span>
                                            </div>
                                        ) : null}
                                        <ChatBubble
                                            message={message}
                                            mine={message.senderId === uid}
                                            currentUid={uid}
                                            peer={peer}
                                            resolveName={resolveName}
                                            onMenu={setMenuMessage}
                                            onRetry={(item) =>
                                                sendVoice({
                                                    file: item._file,
                                                    duration: item.duration,
                                                    messageId: item.id,
                                                    localUrl: item._localUrl
                                                })
                                            }
                                            onReact={(emoji) => handleReact(message, emoji)}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                        <div ref={bottomRef} className="h-1" />
                    </>
                )}
            </div>

            <div className="safe-bottom border-t border-line bg-card px-3 py-2.5">
                {replyTo ? (
                    <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-2">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                            <Mic className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-2xs font-bold text-accent">
                                Replying to{" "}
                                {replyTo.senderId === uid
                                    ? "yourself"
                                    : peer?.displayName || "this user"}
                            </p>
                            <p className="truncate text-xs text-muted">Voice message</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setReplyTo(null)}
                            className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink"
                            aria-label="Cancel reply"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                ) : null}

                <div className="flex items-center gap-2">
                    <input
                        ref={fileRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            if (file) handleAudioFile(file);
                        }}
                    />
                    <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={uploading}
                        className="flex size-10 shrink-0 items-center justify-center rounded-full border border-line bg-bg text-muted hover:border-accent hover:text-accent disabled:opacity-40"
                        aria-label="Attach an audio file"
                    >
                        <Paperclip className="size-[18px]" />
                    </button>
                    <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium">
                            {uploading ? "Uploading voice note…" : "Record or attach a voice note"}
                        </p>
                        <p className="truncate text-2xs text-muted">
                            Audio stays private to this conversation.
                        </p>
                    </div>
                    {uploading ? (
                        <Spinner className="size-5 text-accent" />
                    ) : (
                        <VoiceRecorder
                            onRecorded={({ file, duration }) => sendVoice({ file, duration })}
                        />
                    )}
                </div>
            </div>

            <MessageMenu
                message={menuMessage}
                mine={menuMessage?.senderId === uid}
                currentUid={uid}
                onClose={() => setMenuMessage(null)}
                onReply={() => handleReply(menuMessage)}
                onEdit={() => setMenuMessage(null)}
                onCopy={() => setMenuMessage(null)}
                onReact={(emoji) => handleReact(menuMessage, emoji)}
                onDeleteForMe={() => {
                    setMenuMessage(null);
                    setConfirm({ message: menuMessage, scope: "me" });
                }}
                onDeleteForEveryone={() => {
                    setMenuMessage(null);
                    setConfirm({ message: menuMessage, scope: "everyone" });
                }}
            />

            <ConfirmDialog
                open={Boolean(confirm)}
                title={confirm?.scope === "everyone" ? "Delete for everyone?" : "Delete voice note?"}
                description={
                    confirm?.scope === "everyone"
                        ? `This voice note will be removed for you and ${
                              peer?.displayName || "the other person"
                          }. This cannot be undone.`
                        : "This voice note will be removed only from your view."
                }
                confirmLabel={
                    confirm?.scope === "everyone" ? "Delete for everyone" : "Delete for me"
                }
                busy={confirmBusy}
                onConfirm={handleDelete}
                onCancel={() => setConfirm(null)}
            />
        </div>
    );
}

function VoiceHeader({ peer, online, subtitle }) {
    return (
        <header className="safe-top sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
            <div className="flex items-center gap-2.5 px-2 py-2">
                <Link
                    to="/voice"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-accent-soft hover:text-accent"
                    aria-label="Back to Voice Pack"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <Avatar
                    name={peer?.displayName}
                    src={peer?.photoURL}
                    uid={peer?.uid}
                    size="sm"
                    online={online}
                />
                <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold leading-tight">
                        {peer?.displayName || "Voice Pack"}
                    </p>
                    <p className="truncate text-2xs text-muted">{subtitle}</p>
                </div>
                <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Mic className="size-4" />
                </span>
            </div>
        </header>
    );
}

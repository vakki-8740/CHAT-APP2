import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, MessageSquare, WifiOff } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { ChatBubble } from "../components/ChatBubble";
import { MessageComposer } from "../components/MessageComposer";
import { MessageMenu } from "../components/MessageMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { ImageLightbox } from "../components/ImageLightbox";
import { LoadingScreen } from "../components/LoadingScreen";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useThread } from "../hooks/useThread";
import { chatService, makeChatId } from "../services/chatService";
import { userService, isOnline } from "../services/userService";
import { storageStatus, uploadFile } from "../services/storageAdapter";
import { validateFile } from "../utils/validation";
import { formatDayLabel, toDate } from "../utils/format";

export default function ChatPage() {
    const { uid: peerUid } = useParams();
    const { uid, profile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [peer, setPeer] = useState(null);
    const [peerError, setPeerError] = useState("");
    const { messages, loading, error, retry } = useThread(chatService, uid, peerUid);

    const [draft, setDraft] = useState("");
    const [replyTo, setReplyTo] = useState(null);
    const [editing, setEditing] = useState(null);
    const [menuMessage, setMenuMessage] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);
    const [lightbox, setLightbox] = useState("");
    const [pending, setPending] = useState([]);
    const [uploading, setUploading] = useState(false);

    const bottomRef = useRef(null);
    const previousCount = useRef(0);

    useEffect(() => {
        if (peerUid === uid) navigate("/", { replace: true });
    }, [peerUid, uid, navigate]);

    useEffect(() => {
        setPending([]);
        setReplyTo(null);
        setEditing(null);
        setDraft("");
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
        chatService.resetUnread({ uid, otherUid: peerUid });
    }, [uid, peerUid, messages.length]);

    useEffect(() => {
        setPending((list) =>
            list.filter(
                (item) =>
                    !messages.some((message) => message.id === item.id && !message.pending)
            )
        );
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

    async function deliver(message) {
        setPending((list) => [
            ...list.filter((item) => item.id !== message.id),
            { ...message, status: message.status || "sending" }
        ]);
        try {
            await chatService.sendMessage({
                uid,
                otherUid: peerUid,
                messageId: message.id,
                type: message.type,
                text: message.text,
                imageUrl: message.imageUrl,
                replyTo: message.replyTo
            });
            setPending((list) =>
                list.map((item) =>
                    item.id === message.id ? { ...item, status: "sent" } : item
                )
            );
            return true;
        } catch (nextError) {
            setPending((list) =>
                list.map((item) =>
                    item.id === message.id
                        ? { ...item, status: "failed", error: nextError.message }
                        : item
                )
            );
            toast.error(nextError.message || "Could not send the message.");
            return false;
        }
    }

    async function handleSend(text) {
        if (editing) {
            const target = editing;
            setEditing(null);
            setDraft("");
            try {
                await chatService.editMessage({
                    uid,
                    otherUid: peerUid,
                    messageId: target.id,
                    text
                });
                toast.success("Message updated.");
            } catch (nextError) {
                setEditing(target);
                setDraft(text);
                toast.error(nextError.message);
            }
            return;
        }

        const message = {
            id: chatService.newMessageId(uid, peerUid),
            senderId: uid,
            type: "text",
            text,
            replyTo: replyTo || null,
            createdAt: new Date()
        };
        setDraft("");
        setReplyTo(null);
        await deliver(message);
    }

    async function handleImage(file) {
        const validation = validateFile(file, "image");
        if (validation) {
            toast.error(validation);
            return;
        }
        const status = storageStatus();
        if (!status.configured) {
            toast.error(status.message);
            return;
        }

        setUploading(true);
        toast.info("Uploading photo…");
        try {
            const { url } = await uploadFile(file, {
                folder: `chatImages/${makeChatId(uid, peerUid)}`
            });
            toast.success("Photo uploaded.");
            const message = {
                id: chatService.newMessageId(uid, peerUid),
                senderId: uid,
                type: "image",
                text: "",
                imageUrl: url,
                replyTo: replyTo || null,
                createdAt: new Date()
            };
            setReplyTo(null);
            await deliver(message);
        } catch (nextError) {
            toast.error(nextError.message || "Upload failed.");
        } finally {
            setUploading(false);
        }
    }

    async function handleReact(message, emoji) {
        setMenuMessage(null);
        try {
            await chatService.react({
                uid,
                otherUid: peerUid,
                messageId: message.id,
                emoji
            });
        } catch (nextError) {
            toast.error(nextError.message);
        }
    }

    function handleCopy(message) {
        setMenuMessage(null);
        if (!message.text) return;
        if (!navigator.clipboard?.writeText) {
            toast.error("Copying is not available in this browser.");
            return;
        }
        navigator.clipboard
            .writeText(message.text)
            .then(() => toast.success("Message copied."))
            .catch(() => toast.error("Could not copy the message."));
    }

    function handleReply(message) {
        setMenuMessage(null);
        setEditing(null);
        setReplyTo(message);
    }

    function handleEdit(message) {
        setMenuMessage(null);
        setReplyTo(null);
        setEditing(message);
        setDraft(message.text || "");
    }

    async function handleDelete() {
        if (!confirm) return;
        setConfirmBusy(true);
        try {
            if (confirm.scope === "permanent") {
                await chatService.deletePermanently({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Deleted permanently.");
            } else if (confirm.scope === "everyone") {
                await chatService.deleteForEveryone({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Deleted for everyone.");
            } else {
                await chatService.deleteForMe({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Deleted for you.");
            }
            if (editing?.id === confirm.message.id) {
                setEditing(null);
                setDraft("");
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
                <ChatHeader peer={peer} online={false} subtitle="Private chat" />
                <ErrorState
                    title="Could not open this chat"
                    message={error}
                    onRetry={retry}
                    retryLabel="Try again"
                />
            </div>
        );
    }

    return (
        <div className="app-frame flex h-[100dvh] flex-col">
            <ChatHeader
                peer={peer}
                online={isOnline(peer)}
                subtitle={
                    peerError
                        ? "Profile unavailable"
                        : peer
                          ? isOnline(peer)
                              ? "Online"
                              : peer.bio || "Private chat"
                          : "Loading…"
                }
            />

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin">
                {loading ? (
                    <LoadingScreen inline label="Loading messages…" />
                ) : combined.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                            <MessageSquare className="size-6" />
                        </span>
                        <p className="text-sm font-semibold">
                            No messages yet with {peer?.displayName || "this user"}
                        </p>
                        <p className="text-xs text-muted">
                            Send the first message to start the conversation.
                        </p>
                    </div>
                ) : (
                    <>
                        {peerError ? (
                            <div className="mb-3 flex items-center gap-2 rounded-md border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
                                <WifiOff className="size-3.5 shrink-0" /> {peerError}
                            </div>
                        ) : null}
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
                                            onOpenImage={setLightbox}
                                            onRetry={(item) => deliver(item)}
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

            <MessageComposer
                value={draft}
                onChange={setDraft}
                onSend={handleSend}
                onImageSelected={handleImage}
                replyTo={replyTo}
                onCancelReply={() => setReplyTo(null)}
                editing={editing}
                onCancelEdit={() => {
                    setEditing(null);
                    setDraft("");
                }}
                currentUid={uid}
                peerName={peer?.displayName || "this user"}
                disabled={uploading}
            />

            <MessageMenu
                message={menuMessage}
                mine={menuMessage?.senderId === uid}
                currentUid={uid}
                onClose={() => setMenuMessage(null)}
                onReply={() => handleReply(menuMessage)}
                onEdit={() => handleEdit(menuMessage)}
                onCopy={() => handleCopy(menuMessage)}
                onReact={(emoji) => handleReact(menuMessage, emoji)}
                onDeleteForMe={() => {
                    setMenuMessage(null);
                    setConfirm({ message: menuMessage, scope: "me" });
                }}
                onDeleteForEveryone={() => {
                    setMenuMessage(null);
                    setConfirm({ message: menuMessage, scope: "everyone" });
                }}
                onDeletePermanently={() => {
                    setMenuMessage(null);
                    setConfirm({ message: menuMessage, scope: "permanent" });
                }}
            />

            <ConfirmDialog
                open={Boolean(confirm)}
                title={
                    confirm?.scope === "permanent"
                        ? "Delete permanently?"
                        : confirm?.scope === "everyone"
                          ? "Delete for everyone?"
                          : "Delete message?"
                }
                description={
                    confirm?.scope === "permanent"
                        ? `This deleted message will be removed from both chats with no trace.`
                        : confirm?.scope === "everyone"
                          ? `This message will be removed for you and ${
                                peer?.displayName || "the other person"
                            }. This cannot be undone.`
                          : "This message will be removed only from your view. The other person will still see it."
                }
                confirmLabel={
                    confirm?.scope === "permanent"
                        ? "Delete permanently"
                        : confirm?.scope === "everyone"
                          ? "Delete for everyone"
                          : "Delete for me"
                }
                busy={confirmBusy}
                onConfirm={handleDelete}
                onCancel={() => setConfirm(null)}
            />

            <ImageLightbox src={lightbox} onClose={() => setLightbox("")} />
        </div>
    );
}

function ChatHeader({ peer, online, subtitle }) {
    return (
        <header className="safe-top sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
            <div className="flex items-center gap-2.5 px-2 py-2">
                <Link
                    to="/"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-accent-soft hover:text-accent"
                    aria-label="Back to chats"
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
                        {peer?.displayName || "Chat"}
                    </p>
                    <p className="truncate text-2xs text-muted">{subtitle}</p>
                </div>
            </div>
        </header>
    );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Camera, Film, Send, Upload, X } from "lucide-react";
import { Avatar } from "../components/Avatar";
import { ChatBubble } from "../components/ChatBubble";
import { DayDivider } from "../components/DayDivider";
import { CallButton } from "../components/CallButton";
import { MessageMenu } from "../components/MessageMenu";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { Spinner } from "../components/LoadingScreen";
import { ErrorState } from "../components/ErrorState";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useThread } from "../hooks/useThread";
import { videoService } from "../services/videoService";
import { makeChatId } from "../services/chatService";
import { userService, isOnline } from "../services/userService";
import { uploadVideoToDrive } from "../services/videoUploadService";
import { validateFile } from "../utils/validation";
import { extractVideoMetadata, formatBytes } from "../utils/files";
import { formatClock, toDate } from "../utils/format";
import { playSound } from "../utils/sounds";

export default function VideoChatPage() {
    const { uid: peerUid } = useParams();
    const { uid, profile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();

    const [peer, setPeer] = useState(null);
    const [peerError, setPeerError] = useState("");
    const { chat, messages, loading, error, retry } = useThread(videoService, uid, peerUid);

    const [replyTo, setReplyTo] = useState(null);
    const [menuMessage, setMenuMessage] = useState(null);
    const [confirm, setConfirm] = useState(null);
    const [confirmBusy, setConfirmBusy] = useState(false);

    const [stagedVideo, setStagedVideo] = useState(null);
    const [preparingVideo, setPreparingVideo] = useState(false);
    const [caption, setCaption] = useState("");

    const [pending, setPending] = useState([]);
    const [uploadState, setUploadState] = useState(null);

    const pickerRef = useRef(null);
    const cameraRef = useRef(null);
    const abortRef = useRef(null);
    const bottomRef = useRef(null);
    const previousCount = useRef(0);

    const hasChat = Boolean(chat);
    const latestMessageId = chat?.lastMessage?.id || "";
    const latestSenderId = chat?.lastMessage?.senderId || "";
    const peerReadAt = toDate(chat?.reads?.[peerUid]);

    useEffect(() => {
        if (peerUid === uid) navigate("/video", { replace: true });
    }, [peerUid, uid, navigate]);

    useEffect(() => {
        setPending([]);
        setReplyTo(null);
        setMenuMessage(null);
        setConfirm(null);
        setStagedVideo(null);
        setCaption("");
        setUploadState(null);
        abortRef.current?.abort?.();
        previousCount.current = 0;
    }, [peerUid]);

    useEffect(() => {
        return () => {
            abortRef.current?.abort?.();
        };
    }, []);

    useEffect(() => {
        if (!peerUid) return undefined;
        setPeer(null);
        setPeerError("");
        return userService.subscribeProfile(peerUid, setPeer, (nextError) =>
            setPeerError(nextError.message)
        );
    }, [peerUid]);

    useEffect(() => {
        if (!uid || !peerUid || !hasChat || !latestMessageId) return undefined;
        if (latestSenderId === uid) return undefined;

        const markRead = () => {
            if (document.visibilityState !== "visible") return;
            videoService.markRead({ uid, otherUid: peerUid });
        };

        markRead();
        document.addEventListener("visibilitychange", markRead);
        window.addEventListener("focus", markRead);
        return () => {
            document.removeEventListener("visibilitychange", markRead);
            window.removeEventListener("focus", markRead);
        };
    }, [uid, peerUid, hasChat, latestMessageId, latestSenderId]);

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

    async function handleSelectVideo(file) {
        const validation = validateFile(file, "video");
        if (validation) {
            toast.error(validation);
            return;
        }
        setPreparingVideo(true);
        try {
            const meta = await extractVideoMetadata(file);
            setStagedVideo({
                file,
                fileName: file.name || "video.mp4",
                fileSize: file.size,
                duration: meta.duration || 0,
                posterUrl: meta.posterUrl || ""
            });
        } finally {
            setPreparingVideo(false);
        }
    }

    async function sendVideo({
        file,
        fileName,
        fileSize,
        duration = 0,
        posterUrl = "",
        text = "",
        messageId = "",
        localUrl = ""
    }) {
        if (!file) return;
        const validation = validateFile(file, "video");
        if (validation) {
            toast.error(validation);
            return;
        }

        const id = messageId || videoService.newMessageId(uid, peerUid);
        const local = localUrl || URL.createObjectURL(file);
        const cleanCaption = String(text || "").trim();
        const replySnapshot = replyTo || null;

        setReplyTo(null);
        setStagedVideo(null);
        setCaption("");

        const optimistic = {
            id,
            senderId: uid,
            type: "video",
            text: cleanCaption,
            videoUrl: local,
            posterUrl,
            fileName: fileName || file.name || "video.mp4",
            fileSize: fileSize || file.size || 0,
            duration: Number(duration) || 0,
            replyTo: replySnapshot,
            createdAt: new Date(),
            status: "uploading",
            uploadProgress: 0,
            _file: file,
            _localUrl: local
        };

        setPending((list) => [
            ...list.filter((item) => item.id !== id),
            optimistic
        ]);

        const controller = new AbortController();
        abortRef.current = controller;
        setUploadState({
            messageId: id,
            percent: 0,
            loaded: 0,
            total: file.size,
            fileName: optimistic.fileName
        });

        try {
            const chatKey = makeChatId(uid, peerUid);
            const uploaded = await uploadVideoToDrive(file, {
                chatKey,
                signal: controller.signal,
                onProgress: ({ percent, loaded, total }) => {
                    setUploadState({
                        messageId: id,
                        percent,
                        loaded,
                        total,
                        fileName: optimistic.fileName
                    });
                    setPending((list) =>
                        list.map((item) =>
                            item.id === id ? { ...item, uploadProgress: percent } : item
                        )
                    );
                }
            });

            setPending((list) =>
                list.map((item) =>
                    item.id === id
                        ? {
                              ...item,
                              videoUrl: uploaded.url,
                              status: "sending",
                              uploadProgress: 100
                          }
                        : item
                )
            );

            await videoService.sendMessage({
                uid,
                otherUid: peerUid,
                messageId: id,
                type: "video",
                text: cleanCaption,
                videoUrl: uploaded.url,
                posterUrl,
                fileName: optimistic.fileName,
                fileSize: uploaded.size || optimistic.fileSize,
                driveFileId: uploaded.driveFileId || "",
                duration: optimistic.duration,
                replyTo: replySnapshot,
                chatExists: Boolean(chat)
            });

            playSound("messageSent");
            setPending((list) =>
                list.map((item) => (item.id === id ? { ...item, status: "sent" } : item))
            );
        } catch (nextError) {
            if (nextError?.code === "storage/cancelled") {
                setPending((list) => list.filter((item) => item.id !== id));
                if (local.startsWith("blob:")) URL.revokeObjectURL(local);
                toast.info("Video upload cancelled.");
            } else {
                setPending((list) =>
                    list.map((item) =>
                        item.id === id
                            ? { ...item, status: "failed", error: nextError.message }
                            : item
                    )
                );
                toast.error(nextError.message || "Could not send video.");
            }
        } finally {
            abortRef.current = null;
            setUploadState(null);
        }
    }

    function cancelActiveUpload() {
        abortRef.current?.abort?.();
    }

    async function handleReact(message, emoji) {
        try {
            const result = await videoService.react({
                uid,
                otherUid: peerUid,
                messageId: message.id,
                emoji
            });
            setMenuMessage((current) =>
                current?.id === message.id
                    ? {
                          ...current,
                          reactions: { ...current.reactions, [uid]: result.reactions }
                      }
                    : current
            );
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
            if (confirm.scope === "permanent") {
                await videoService.deletePermanently({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Removed from chat.");
            } else if (confirm.scope === "everyone") {
                await videoService.deleteForEveryone({
                    uid,
                    otherUid: peerUid,
                    messageId: confirm.message.id
                });
                toast.success("Deleted for everyone.");
            } else {
                await videoService.deleteForMe({
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
        const friendly = /permission/i.test(error)
            ? "Firestore rules need to be updated for Video Pack. Open Admin Panel → Copy Firestore Rules and Publish in Firebase Console."
            : error;
        return (
            <div className="app-frame">
                <VideoHeader peer={peer} online={false} subtitle="Video Pack" />
                <ErrorState
                    title="Could not open this Video Pack chat"
                    message={friendly}
                    onRetry={retry}
                    retryLabel="Try again"
                />
            </div>
        );
    }

    const isUploading = Boolean(uploadState);

    return (
        <div className="app-frame flex h-[100dvh] flex-col">
            <VideoHeader
                peer={peer}
                online={isOnline(peer)}
                subtitle={
                    peerError
                        ? "Profile unavailable"
                        : peer
                          ? "Video Pack · up to 200 MB"
                          : "Loading…"
                }
            />

            <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 scrollbar-thin">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                        <Spinner className="size-4" /> Loading videos…
                    </div>
                ) : combined.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
                        <span className="flex size-12 items-center justify-center rounded-full bg-accent-soft text-accent">
                            <Film className="size-6" />
                        </span>
                        <p className="text-sm font-semibold">
                            No videos shared yet with {peer?.displayName || "this user"}
                        </p>
                        <p className="text-xs text-muted">
                            Choose a video from gallery or record one (up to 200 MB). Videos stay permanently playable anytime.
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
                                const messageDate = toDate(message.createdAt);
                                const seen =
                                    !message.status &&
                                    Boolean(peerReadAt) &&
                                    Boolean(messageDate) &&
                                    messageDate <= peerReadAt;

                                return (
                                    <div key={message.id}>
                                        {showDay ? (
                                            <DayDivider value={message.createdAt} />
                                        ) : null}
                                        <ChatBubble
                                            message={message}
                                            mine={message.senderId === uid}
                                            currentUid={uid}
                                            peer={peer}
                                            resolveName={resolveName}
                                            seen={seen}
                                            onMenu={setMenuMessage}
                                            onRetry={(item) =>
                                                sendVideo({
                                                    file: item._file,
                                                    fileName: item.fileName,
                                                    fileSize: item.fileSize,
                                                    duration: item.duration,
                                                    posterUrl: item.posterUrl,
                                                    text: item.text,
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
                            <Film className="size-3.5" />
                        </span>
                        <div className="min-w-0 flex-1">
                            <p className="truncate text-2xs font-bold text-accent">
                                Replying to{" "}
                                {replyTo.senderId === uid
                                    ? "yourself"
                                    : peer?.displayName || "this user"}
                            </p>
                            <p className="truncate text-xs text-muted">
                                {replyTo.fileName || replyTo.text || "Video"}
                            </p>
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

                {uploadState ? (
                    <div className="mb-2 rounded-xl border border-line bg-bg px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex min-w-0 items-center gap-2">
                                <Spinner className="size-4 shrink-0 text-accent" />
                                <span className="truncate font-semibold text-ink">
                                    Uploading {uploadState.fileName}
                                </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <span className="font-bold tabular-nums text-accent">
                                    {uploadState.percent}%
                                </span>
                                <button
                                    type="button"
                                    onClick={cancelActiveUpload}
                                    className="rounded-md px-2 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger/10"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-line">
                            <div
                                className="h-full rounded-full bg-accent transition-all duration-200"
                                style={{ width: `${Math.max(3, uploadState.percent)}%` }}
                            />
                        </div>
                        <p className="mt-1 text-[10px] text-muted tabular-nums">
                            {formatBytes(uploadState.loaded)} / {formatBytes(uploadState.total)} · Google Drive permanent upload
                        </p>
                    </div>
                ) : null}

                {preparingVideo ? (
                    <div className="mb-2 flex items-center gap-2 rounded-xl border border-line bg-bg px-3 py-2 text-xs font-medium text-muted">
                        <Spinner className="size-4 text-accent" />
                        Preparing video preview…
                    </div>
                ) : null}

                {stagedVideo && !isUploading ? (
                    <div className="space-y-2 rounded-xl border border-accent/35 bg-bg p-2.5">
                        <div className="flex items-center gap-2.5">
                            {stagedVideo.posterUrl ? (
                                <img
                                    src={stagedVideo.posterUrl}
                                    alt=""
                                    className="h-14 w-20 shrink-0 rounded-lg bg-black object-cover"
                                />
                            ) : (
                                <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                                    <Film className="size-6" />
                                </span>
                            )}
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-ink">
                                    {stagedVideo.fileName}
                                </p>
                                <p className="mt-0.5 text-[11px] text-muted tabular-nums">
                                    {formatBytes(stagedVideo.fileSize)} / 200 MB
                                    {stagedVideo.duration > 0
                                        ? ` · ${formatClock(stagedVideo.duration)}`
                                        : ""}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setStagedVideo(null);
                                    setCaption("");
                                }}
                                className="flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink"
                                aria-label="Remove selected video"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={caption}
                                onChange={(e) => setCaption(e.target.value)}
                                maxLength={400}
                                placeholder="Add a caption (optional)…"
                                className="input h-10 flex-1 text-sm"
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        sendVideo({
                                            ...stagedVideo,
                                            text: caption
                                        });
                                    }
                                }}
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    sendVideo({
                                        ...stagedVideo,
                                        text: caption
                                    })
                                }
                                className="btn btn-primary h-10 shrink-0 px-4 text-sm"
                            >
                                <Send className="size-4" /> Send
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        <input
                            ref={pickerRef}
                            type="file"
                            accept="video/*,.mp4,.mov,.webm,.mkv,.m4v,.3gp"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) handleSelectVideo(file);
                            }}
                        />
                        <input
                            ref={cameraRef}
                            type="file"
                            accept="video/*"
                            capture="environment"
                            className="hidden"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                event.target.value = "";
                                if (file) handleSelectVideo(file);
                            }}
                        />

                        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
                            <button
                                type="button"
                                onClick={() => pickerRef.current?.click()}
                                disabled={isUploading || preparingVideo}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition-opacity hover:opacity-95 disabled:opacity-45"
                            >
                                <Upload className="size-[18px]" />
                                Upload Video
                            </button>
                            <button
                                type="button"
                                onClick={() => cameraRef.current?.click()}
                                disabled={isUploading || preparingVideo}
                                className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line bg-bg px-3 text-sm font-semibold text-muted hover:border-accent hover:text-accent disabled:opacity-45"
                            >
                                <Camera className="size-[18px]" />
                                Record
                            </button>
                        </div>
                        <p className="mt-1.5 text-center text-[10px] font-medium text-muted">
                            Max 200 MB · MP4, MOV, WebM, MKV · Stored permanently
                        </p>
                    </>
                )}
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
                          : "Delete video?"
                }
                description={
                    confirm?.scope === "permanent"
                        ? "This deleted video placeholder will be removed from both chats."
                        : confirm?.scope === "everyone"
                          ? `This video will be removed for you and ${
                                peer?.displayName || "the other person"
                            }.`
                          : "This video will be removed only from your view."
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
        </div>
    );
}

function VideoHeader({ peer, online, subtitle }) {
    return (
        <header className="safe-top sticky top-0 z-20 border-b border-line bg-card/95 backdrop-blur">
            <div className="flex items-center gap-2.5 px-2 py-2">
                <Link
                    to="/video"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full text-ink hover:bg-accent-soft hover:text-accent"
                    aria-label="Back to Video Pack"
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
                        {peer?.displayName || "Video Pack"}
                    </p>
                    <p className="truncate text-2xs text-muted">{subtitle}</p>
                </div>
                <CallButton peer={peer} />
            </div>
        </header>
    );
}

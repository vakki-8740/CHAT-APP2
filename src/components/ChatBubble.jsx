import { useEffect, useState } from "react";
import {
    AlertCircle,
    Ban,
    Check,
    CheckCheck,
    Clock3,
    ImageOff,
    MoreHorizontal,
    RotateCw
} from "lucide-react";
import { Avatar } from "./Avatar";
import { VoicePlayer } from "./VoicePlayer";
import { formatTime } from "../utils/format";
import { mergeReactions } from "../utils/emoji";
import { cn } from "../utils/cn";

function replyPreview(replyTo) {
    if (!replyTo) return "";
    if (replyTo.type === "image") return "Photo";
    if (replyTo.type === "voice") return "Voice message";
    return replyTo.text || "Message";
}

export function ChatBubble({
    message,
    mine,
    currentUid,
    peer,
    resolveName,
    onMenu,
    onOpenImage,
    onRetry,
    onReact,
    seen = false
}) {
    const deleted = Boolean(message.deletedForEveryone);
    const failed = message.status === "failed";
    const sending = message.status === "sending" || message.status === "uploading";
    const showReceipt = mine && !deleted && !failed && !sending;
    const reactions = mergeReactions(message.reactions);
    const [imageBroken, setImageBroken] = useState(false);

    useEffect(() => {
        setImageBroken(false);
    }, [message.imageUrl]);

    return (
        <div className={cn("flex w-full items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
            {!mine ? (
                <Avatar
                    name={peer?.displayName}
                    src={peer?.photoURL}
                    uid={peer?.uid}
                    size="xs"
                    className="mb-0.5"
                />
            ) : null}

            <div className={cn("flex max-w-[80%] flex-col", mine ? "items-end" : "items-start")}>
                <div
                    className={cn(
                        "relative rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                        mine
                            ? "rounded-br-md bg-accent text-white"
                            : "rounded-bl-md border border-line bg-card text-ink"
                    )}
                >
                    {message.replyTo && !deleted ? (
                        <div
                            className={cn(
                                "mb-1.5 rounded-md border-l-2 px-2 py-1 text-xs",
                                mine
                                    ? "border-white/60 bg-black/10 text-white/85"
                                    : "border-accent bg-accent-soft text-muted"
                            )}
                        >
                            <p className="font-semibold">
                                {message.replyTo.senderId === currentUid
                                    ? "You"
                                    : resolveName(message.replyTo.senderId)}
                            </p>
                            <p className="line-clamp-2 break-words">
                                {replyPreview(message.replyTo)}
                            </p>
                        </div>
                    ) : null}

                    {deleted ? (
                        <p className="flex items-center gap-1.5 italic opacity-80">
                            <Ban className="size-3.5 shrink-0" /> This message was deleted
                        </p>
                    ) : message.type === "image" ? (
                        imageBroken || !message.imageUrl ? (
                            <p className="flex items-center gap-1.5 italic opacity-80">
                                <ImageOff className="size-3.5 shrink-0" /> Photo unavailable
                            </p>
                        ) : (
                            <button
                                type="button"
                                onClick={() =>
                                    message.imageUrl && onOpenImage?.(message.imageUrl)
                                }
                                className="block overflow-hidden rounded-lg"
                                aria-label="Open photo"
                            >
                                <img
                                    src={message.imageUrl}
                                    alt={message.text || "Shared photo"}
                                    className="max-h-72 w-auto max-w-full object-cover"
                                    loading="lazy"
                                    onError={() => setImageBroken(true)}
                                />
                            </button>
                        )
                    ) : message.type === "voice" ? (
                        <VoicePlayer
                            src={message.audioUrl}
                            duration={message.duration}
                            tone={mine ? "onAccent" : "default"}
                        />
                    ) : (
                        <p className="whitespace-pre-wrap break-words">{message.text}</p>
                    )}

                    <p
                        className={cn(
                            "mt-1 flex items-center justify-end gap-1 text-[10px] leading-none",
                            mine ? "text-white/70" : "text-muted"
                        )}
                    >
                        {sending ? <Clock3 className="size-3" /> : null}
                        <span>{formatTime(message.createdAt)}</span>
                        {showReceipt ? (
                            seen ? (
                                <CheckCheck
                                    className="size-3.5 text-white"
                                    aria-label="Seen"
                                />
                            ) : (
                                <Check
                                    className="size-3 text-white/60"
                                    aria-label="Sent"
                                />
                            )
                        ) : null}
                        {message.editedAt && !deleted ? <span>· edited</span> : null}
                    </p>
                </div>

                {reactions.length ? (
                    <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "")}>
                        {reactions.map((reaction) => {
                            const isMine = reaction.uids.includes(currentUid);
                            return (
                                <button
                                    key={reaction.emoji}
                                    type="button"
                                    onClick={() => onReact?.(isMine ? "" : reaction.emoji)}
                                    className={cn(
                                        "flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs",
                                        isMine
                                            ? "border-accent bg-accent-soft text-accent"
                                            : "border-line bg-card text-muted hover:border-accent"
                                    )}
                                    aria-label={`${reaction.count} reaction ${reaction.emoji}`}
                                >
                                    <span>{reaction.emoji}</span>
                                    {reaction.count > 1 ? <span>{reaction.count}</span> : null}
                                </button>
                            );
                        })}
                    </div>
                ) : null}

                {failed ? (
                    <button
                        type="button"
                        onClick={() => onRetry?.(message)}
                        className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-danger hover:underline"
                    >
                        <AlertCircle className="size-3" /> Not sent · Retry
                        <RotateCw className="size-3" />
                    </button>
                ) : null}
            </div>

            {!message.status ? (
                <button
                    type="button"
                    onClick={() => onMenu?.(message)}
                    className={cn(
                        "-mb-1 flex size-7 shrink-0 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink",
                        mine ? "order-first" : ""
                    )}
                    aria-label="Message actions"
                >
                    <MoreHorizontal className="size-4" />
                </button>
            ) : null}
        </div>
    );
}

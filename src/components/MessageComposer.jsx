import { useEffect, useRef, useState } from "react";
import { ImagePlus, Pencil, Reply, Send, Smile, X } from "lucide-react";
import { EmojiPicker } from "./EmojiPicker";
import { limits } from "../config/app";

export function MessageComposer({
    value,
    onChange,
    onSend,
    onImageSelected,
    replyTo,
    onCancelReply,
    editing,
    onCancelEdit,
    currentUid,
    peerName = "this user",
    disabled = false
}) {
    const areaRef = useRef(null);
    const fileRef = useRef(null);
    const [emojiOpen, setEmojiOpen] = useState(false);

    useEffect(() => {
        const area = areaRef.current;
        if (!area) return;
        area.style.height = "auto";
        area.style.height = `${Math.min(area.scrollHeight, 128)}px`;
    }, [value]);

    useEffect(() => {
        if (replyTo || editing) areaRef.current?.focus();
    }, [replyTo, editing]);

    function submit() {
        if (disabled || !value.trim()) return;
        onSend(value.trim());
        setEmojiOpen(false);
    }

    function handleKeyDown(event) {
        if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
            event.preventDefault();
            submit();
        }
    }

    function handleFile(event) {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (file) onImageSelected?.(file);
    }

    const overLimit = value.length > limits.messageMaxLength;

    return (
        <div className="safe-bottom border-t border-line bg-card px-2 pb-2 pt-2">
            {editing ? (
                <Banner
                    icon={Pencil}
                    title="Editing message"
                    body={editing.text}
                    onClose={onCancelEdit}
                />
            ) : replyTo ? (
                <Banner
                    icon={Reply}
                    title={
                        replyTo.senderId === currentUid
                            ? "Replying to yourself"
                            : `Replying to ${peerName}`
                    }
                    body={
                        replyTo.type === "image"
                            ? "Photo"
                            : replyTo.type === "voice"
                              ? "Voice message"
                              : replyTo.text
                    }
                    onClose={onCancelReply}
                />
            ) : null}

            <div className="relative flex items-end gap-1">
                <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFile}
                />
                <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-accent"
                    aria-label="Send a photo"
                    disabled={disabled}
                >
                    <ImagePlus className="size-5" />
                </button>

                <div className="relative mb-0.5">
                    <button
                        type="button"
                        onClick={() => setEmojiOpen((open) => !open)}
                        className="flex size-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-bg hover:text-accent"
                        aria-label="Add emoji"
                        aria-expanded={emojiOpen}
                        disabled={disabled}
                    >
                        <Smile className="size-5" />
                    </button>
                    {emojiOpen ? (
                        <EmojiPicker
                            onPick={(emoji) => onChange(value + emoji)}
                            onClose={() => setEmojiOpen(false)}
                        />
                    ) : null}
                </div>

                <div className="flex min-h-[40px] flex-1 items-center rounded-2xl border border-line bg-bg px-3 py-1.5">
                    <textarea
                        ref={areaRef}
                        rows={1}
                        value={value}
                        onChange={(event) => onChange(event.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={editing ? "Edit your message" : "Write a message…"}
                        className="max-h-32 w-full resize-none bg-transparent text-sm leading-relaxed outline-none placeholder:text-muted"
                        aria-label="Message"
                        disabled={disabled}
                    />
                </div>

                <button
                    type="button"
                    onClick={submit}
                    disabled={disabled || !value.trim() || overLimit}
                    className="mb-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
                    aria-label={editing ? "Save changes" : "Send message"}
                >
                    <Send className="size-[18px]" />
                </button>
            </div>

            {overLimit ? (
                <p className="mt-1 text-right text-2xs text-danger">
                    {value.length} / {limits.messageMaxLength} characters
                </p>
            ) : null}
        </div>
    );
}

function Banner({ icon: Icon, title, body, onClose }) {
    return (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1">
                <p className="truncate text-2xs font-bold text-accent">{title}</p>
                <p className="truncate text-xs text-muted">{body}</p>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="flex size-7 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink"
                aria-label="Cancel"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}

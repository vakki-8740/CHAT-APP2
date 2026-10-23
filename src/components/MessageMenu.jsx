import { Ban, Copy, Pencil, Reply, Trash2, Users, X } from "lucide-react";
import { REACTION_PALETTE } from "../utils/emoji";
import { cn } from "../utils/cn";

function Action({ icon: Icon, label, onClick, danger = false }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                "flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors",
                danger ? "text-danger hover:bg-danger/10" : "text-ink hover:bg-accent-soft"
            )}
        >
            <Icon className="size-4 shrink-0" />
            <span>{label}</span>
        </button>
    );
}

export function MessageMenu({
    message,
    mine,
    currentUid,
    onClose,
    onReply,
    onEdit,
    onCopy,
    onReact,
    onDeleteForMe,
    onDeleteForEveryone,
    onDeletePermanently
}) {
    if (!message) return null;

    const deleted = Boolean(message.deletedForEveryone);
    const currentReaction = message.reactions?.[currentUid] || "";
    const canCopy = !deleted && message.type === "text" && Boolean(message.text);
    const canEdit = mine && !deleted && message.type === "text";

    return (
        <div
            className="fixed inset-0 z-[65] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Message actions"
            onMouseDown={onClose}
        >
            <div
                className="animate-fade-in w-full max-w-sm rounded-t-2xl border border-line bg-card pb-[env(safe-area-inset-bottom)] shadow-sheet sm:rounded-xl"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="flex justify-center pt-2 sm:hidden">
                    <span className="h-1 w-9 rounded-full bg-line" />
                </div>

                {!deleted ? (
                    <div className="border-b border-line px-3 py-3">
                        <div className="flex flex-wrap items-center justify-center gap-1.5">
                            {REACTION_PALETTE.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => onReact(currentReaction === emoji ? "" : emoji)}
                                    className={cn(
                                        "flex size-10 items-center justify-center rounded-full text-xl transition-transform hover:scale-110",
                                        currentReaction === emoji
                                            ? "bg-accent-soft ring-1 ring-accent"
                                            : "hover:bg-bg"
                                    )}
                                    aria-label={`React with ${emoji}`}
                                    aria-pressed={currentReaction === emoji}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                    </div>
                ) : null}

                <div className="p-2">
                    {!deleted ? <Action icon={Reply} label="Reply" onClick={onReply} /> : null}
                    {canCopy ? <Action icon={Copy} label="Copy text" onClick={onCopy} /> : null}
                    {canEdit ? <Action icon={Pencil} label="Edit message" onClick={onEdit} /> : null}
                    <Action
                        icon={Ban}
                        label="Delete for me"
                        onClick={onDeleteForMe}
                        danger
                    />
                    {mine && deleted ? (
                        <Action
                            icon={Trash2}
                            label="Delete permanently"
                            onClick={onDeletePermanently}
                            danger
                        />
                    ) : null}
                    {mine && !deleted ? (
                        <Action
                            icon={Users}
                            label="Delete for everyone"
                            onClick={onDeleteForEveryone}
                            danger
                        />
                    ) : null}
                </div>

                <div className="border-t border-line p-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-semibold text-muted hover:bg-bg hover:text-ink"
                    >
                        <X className="size-4" /> Close
                    </button>
                </div>
            </div>
        </div>
    );
}

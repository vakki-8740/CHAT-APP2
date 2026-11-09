import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
    BellRing,
    ChevronRight,
    FileText,
    Image as ImageIcon,
    Inbox,
    Mic,
    Paperclip,
    Video,
    X
} from "lucide-react";
import { Avatar } from "./Avatar";
import { formatClock, formatListTime } from "../utils/format";
import { isOnline } from "../services/userService";
import { cn } from "../utils/cn";

/**
 * Offline Missed Messages popup.
 *
 * Shows everything the user received while they were away - text, photos,
 * voice notes and videos - grouped per person and pack. It is presentational
 * only: closing it never marks a message as read, so the existing unread
 * badges and chat behaviour stay exactly as they are.
 */

const MAX_ITEMS_PER_GROUP = 6;

const TYPE_META = {
    text: { icon: FileText, tone: "bg-accent-soft text-accent", label: "Message" },
    image: { icon: ImageIcon, tone: "bg-accent-soft text-accent", label: "Photo" },
    voice: { icon: Mic, tone: "bg-success/10 text-success", label: "Voice note" },
    video: { icon: Video, tone: "bg-warn/10 text-warn", label: "Video" }
};

function metaFor(type) {
    return TYPE_META[type] || { icon: Paperclip, tone: "bg-accent-soft text-accent", label: "Message" };
}

function MissedItem({ message }) {
    const { icon: Icon, tone } = metaFor(message.type);

    return (
        <li className="flex items-center gap-2.5 py-1.5">
            {message.type === "image" && message.imageUrl ? (
                <img
                    src={message.imageUrl}
                    alt=""
                    loading="lazy"
                    className="size-9 shrink-0 rounded-[6px] border border-line object-cover"
                />
            ) : (
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-[6px]", tone)}>
                    <Icon className="size-4" />
                </span>
            )}

            <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                    {message.preview || metaFor(message.type).label}
                </span>
                <span className="mt-0.5 flex items-center gap-1.5 text-2xs text-muted">
                    <span>{metaFor(message.type).label}</span>
                    {message.type === "voice" && message.duration > 0 ? (
                        <>
                            <span aria-hidden="true">&middot;</span>
                            <span>{formatClock(message.duration)}</span>
                        </>
                    ) : null}
                    {message.edited ? (
                        <>
                            <span aria-hidden="true">&middot;</span>
                            <span>edited</span>
                        </>
                    ) : null}
                </span>
            </span>

            <span className="shrink-0 text-2xs text-muted">
                {formatListTime(message.createdAt)}
            </span>
        </li>
    );
}

function MissedGroup({ group, onOpen }) {
    const name = group.profile?.displayName || "User";
    const shown = group.items.slice(0, MAX_ITEMS_PER_GROUP);
    const hidden = group.items.length - shown.length;

    return (
        <li className="px-4 py-3">
            <button
                type="button"
                onClick={() => onOpen(group)}
                className="flex w-full items-center gap-3 text-left transition-colors hover:opacity-80"
            >
                <Avatar
                    name={name}
                    src={group.profile?.photoURL}
                    uid={group.peerUid}
                    size="md"
                    online={isOnline(group.profile)}
                />
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-semibold leading-tight">{name}</span>
                        <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-2xs font-semibold text-accent">
                            {group.kindLabel}
                        </span>
                    </span>
                    <span className="mt-0.5 block text-2xs text-muted">
                        {group.items.length} missed {group.items.length === 1 ? "item" : "items"}
                        {group.items[group.items.length - 1]?.createdAt
                            ? ` · last ${formatListTime(group.items[group.items.length - 1].createdAt)}`
                            : ""}
                    </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted" />
            </button>

            <ul className="mt-2 divide-y divide-line/60 border-t border-line/60 pl-12">
                {shown.map((message) => (
                    <MissedItem key={`${group.key}:${message.id}`} message={message} />
                ))}
            </ul>

            {hidden > 0 ? (
                <button
                    type="button"
                    onClick={() => onOpen(group)}
                    className="mt-1.5 pl-12 text-2xs font-semibold text-accent hover:underline"
                >
                    + {hidden} more &mdash; tap to open
                </button>
            ) : null}
        </li>
    );
}

export function MissedMessagesPopup({ open, groups, counts, onClose }) {
    const navigate = useNavigate();

    useEffect(() => {
        if (!open) return undefined;
        function onKey(event) {
            if (event.key === "Escape") onClose?.();
        }
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    function openGroup(group) {
        onClose?.();
        navigate(`${group.route}/${group.peerUid}`);
    }

    const headline =
        counts.total > 0
            ? `${counts.total} missed ${counts.total === 1 ? "message" : "messages"}`
            : "No missed messages";

    return (
        <div
            className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3 pb-3 sm:items-center sm:p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="missed-popup-title"
            onMouseDown={onClose}
        >
            <div
                className="animate-fade-in flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-xl border border-line bg-card shadow-sheet"
                onMouseDown={(event) => event.stopPropagation()}
            >
                {/* ---------- header ---------- */}
                <div className="flex items-start gap-3 border-b border-line px-4 py-3.5">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                        <BellRing className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                        <h2 id="missed-popup-title" className="text-[15px] font-bold leading-tight">
                            Missed while you were away
                        </h2>
                        <p className="mt-0.5 text-sm text-muted">
                            {counts.people > 0
                                ? `${headline} from ${counts.people} ${
                                      counts.people === 1 ? "person" : "people"
                                  }`
                                : headline}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="-mr-1 -mt-1 flex size-8 shrink-0 items-center justify-center rounded-full text-muted hover:text-ink"
                        aria-label="Close"
                    >
                        <X className="size-4" />
                    </button>
                </div>

                {/* ---------- type summary ---------- */}
                {counts.total > 0 ? (
                    <div className="flex flex-wrap gap-1.5 border-b border-line px-4 py-2.5">
                        {Object.entries(counts.byType).map(([type, count]) => {
                            const { icon: Icon, tone, label } = metaFor(type);
                            return (
                                <span
                                    key={type}
                                    className={cn(
                                        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-2xs font-semibold",
                                        tone
                                    )}
                                >
                                    <Icon className="size-3.5" />
                                    {count} {label}
                                    {count === 1 ? "" : "s"}
                                </span>
                            );
                        })}
                    </div>
                ) : null}

                {/* ---------- groups ---------- */}
                <div className="min-h-0 flex-1 overflow-y-auto">
                    {groups.length === 0 ? (
                        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                            <Inbox className="size-7 text-muted" />
                            <p className="text-sm text-muted">
                                You are all caught up. Nothing new arrived while you were away.
                            </p>
                        </div>
                    ) : (
                        <ul className="divide-y divide-line">
                            {groups.map((group) => (
                                <MissedGroup key={group.key} group={group} onOpen={openGroup} />
                            ))}
                        </ul>
                    )}
                </div>

                {/* ---------- footer ---------- */}
                <div className="border-t border-line px-4 py-3">
                    {groups.length > 0 ? (
                        <p className="mb-2.5 text-center text-2xs text-muted">
                            Tap a person to open the conversation. Badges clear when you open it.
                        </p>
                    ) : null}
                    <button type="button" className="btn btn-secondary w-full" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

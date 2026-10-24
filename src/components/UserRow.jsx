import { Link } from "react-router-dom";
import { CheckCheck } from "lucide-react";
import { Avatar } from "./Avatar";
import { isOnline } from "../services/userService";
import { formatListTime } from "../utils/format";
import { cn } from "../utils/cn";

function previewText(chat, currentUid) {
    if (!chat?.lastMessage) return "Tap to start chatting";
    const { lastMessage } = chat;
    if (lastMessage.deletedForEveryone) return "Message deleted";
    const body = lastMessage.text || "Message";
    return lastMessage.senderId === currentUid ? `You: ${body}` : body;
}

export function UserRow({ user, to, currentUid, className }) {
    const unread = Number(user.chat?.unread?.[currentUid] || 0);
    const mine = user.chat?.lastMessage?.senderId === currentUid;

    return (
        <Link
            to={to}
            className={cn(
                "flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent-soft focus-visible:bg-accent-soft",
                className
            )}
        >
            <Avatar
                name={user.displayName}
                src={user.photoURL}
                uid={user.uid}
                size="md"
                online={isOnline(user)}
            />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[15px] font-semibold leading-tight">
                        {user.displayName || "User"}
                    </p>
                    <span className="shrink-0 text-2xs text-muted">
                        {formatListTime(user.chat?.lastMessage?.createdAt)}
                    </span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-2">
                    <p
                        className={cn(
                            "flex min-w-0 items-center gap-1 truncate text-sm",
                            unread > 0 ? "font-medium text-ink" : "text-muted"
                        )}
                    >
                        {mine ? <CheckCheck className="size-3.5 shrink-0 text-accent" /> : null}
                        <span className="truncate">{previewText(user.chat, currentUid)}</span>
                    </p>
                    {unread > 0 ? (
                        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[11px] font-bold text-white">
                            {unread > 99 ? "99+" : unread}
                        </span>
                    ) : null}
                </div>
            </div>
        </Link>
    );
}

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, Phone, Video, X } from "lucide-react";
import { Spinner } from "./LoadingScreen";
import { Avatar } from "./Avatar";
import { useCall } from "../context/CallContext";
import { cn } from "../utils/cn";

const OPTIONS = [
    {
        type: "voice",
        icon: Phone,
        title: "Voice call",
        description: "Clear audio, lower data use"
    },
    {
        type: "video",
        icon: Video,
        title: "Video call",
        description: "Camera and microphone"
    }
];

export function CallButton({ peer, className }) {
    const { startCall, activeCall, incomingCall } = useCall();
    const [open, setOpen] = useState(false);
    const [type, setType] = useState("voice");
    const [busy, setBusy] = useState(false);

    const unavailable = !peer || Boolean(activeCall) || Boolean(incomingCall);

    useEffect(() => {
        if (activeCall || incomingCall) setOpen(false);
    }, [activeCall, incomingCall]);

    async function handleStart() {
        if (!peer || busy) return;
        setBusy(true);
        const started = await startCall(peer, type);
        setBusy(false);
        if (started) setOpen(false);
    }

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={unavailable}
                className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full text-ink transition-colors hover:bg-accent-soft hover:text-accent disabled:opacity-40",
                    className
                )}
                aria-label={`Call ${peer?.displayName || "this user"}`}
                title="Voice or video call"
            >
                <Phone className="size-5" />
            </button>

            {open
                ? createPortal(
                <div
                    className="fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-3 pb-3 sm:items-center sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Start a call"
                    onMouseDown={() => !busy && setOpen(false)}
                >
                    <div
                        className="animate-fade-in w-full max-w-sm rounded-t-2xl border border-line bg-card p-5 shadow-sheet sm:rounded-xl"
                        onMouseDown={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start gap-3">
                            <Avatar
                                name={peer?.displayName}
                                src={peer?.photoURL}
                                uid={peer?.uid}
                                size="md"
                            />
                            <div className="min-w-0 flex-1">
                                <h2 className="truncate text-[15px] font-bold">
                                    Call {peer?.displayName || "user"}
                                </h2>
                                <p className="text-xs text-muted">
                                    Choose a call type, then start the call.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                disabled={busy}
                                className="-mr-1 -mt-1 flex size-8 items-center justify-center rounded-full text-muted hover:text-ink"
                                aria-label="Close"
                            >
                                <X className="size-4" />
                            </button>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                            {OPTIONS.map((option) => {
                                const Icon = option.icon;
                                const selected = type === option.type;
                                return (
                                    <button
                                        key={option.type}
                                        type="button"
                                        onClick={() => setType(option.type)}
                                        disabled={busy}
                                        aria-pressed={selected}
                                        className={cn(
                                            "relative rounded-xl border p-3 text-left transition-colors",
                                            selected
                                                ? "border-accent bg-accent-soft"
                                                : "border-line bg-bg hover:border-accent/60"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "flex size-9 items-center justify-center rounded-full",
                                                selected
                                                    ? "bg-accent text-white"
                                                    : "bg-card text-muted"
                                            )}
                                        >
                                            <Icon className="size-4" />
                                        </span>
                                        <span className="mt-2 block text-sm font-bold">
                                            {option.title}
                                        </span>
                                        <span className="mt-0.5 block text-[11px] leading-snug text-muted">
                                            {option.description}
                                        </span>
                                        {selected ? (
                                            <CheckCircle2 className="absolute right-2.5 top-2.5 size-4 text-accent" />
                                        ) : null}
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={handleStart}
                            disabled={busy}
                            className="btn btn-primary mt-4 w-full"
                        >
                            {busy ? (
                                <Spinner className="size-4" />
                            ) : type === "video" ? (
                                <Video className="size-4" />
                            ) : (
                                <Phone className="size-4" />
                            )}
                            {busy
                                ? "Starting…"
                                : type === "video"
                                  ? "Start video call"
                                  : "Start voice call"}
                        </button>
                    </div>
                </div>,
                document.body
            )
                : null}
        </>
    );
}

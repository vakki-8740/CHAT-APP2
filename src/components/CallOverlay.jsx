import { useEffect, useRef, useState } from "react";
import {
    Mic,
    MicOff,
    Phone,
    PhoneOff,
    SwitchCamera,
    Video,
    VideoOff
} from "lucide-react";
import { Avatar } from "./Avatar";
import { Spinner } from "./LoadingScreen";
import { useCall } from "../context/CallContext";
import { formatClock } from "../utils/format";
import { playRingtone, stopRingtone } from "../utils/sounds";
import { cn } from "../utils/cn";

function StreamVideo({ stream, muted = false, mirrored = false, className }) {
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream || null;
        if (stream) element.play?.().catch(() => {});
    }, [stream]);

    return (
        <video
            ref={ref}
            autoPlay
            playsInline
            muted={muted}
            className={cn(className, mirrored ? "scale-x-[-1]" : "")}
        />
    );
}

function StreamAudio({ stream }) {
    const ref = useRef(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;
        element.srcObject = stream || null;
        if (stream) element.play?.().catch(() => {});
    }, [stream]);

    return <audio ref={ref} autoPlay playsInline />;
}

function CallTimer({ connectedAt }) {
    const [now, setNow] = useState(Date.now());

    useEffect(() => {
        if (!connectedAt) return undefined;
        const timer = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [connectedAt]);

    if (!connectedAt) return null;
    const seconds = Math.max(0, Math.floor((now - connectedAt) / 1000));
    return <span>{formatClock(seconds)}</span>;
}

function statusText(call) {
    if (call.status === "ringing") return "Ringing…";
    if (call.status === "connecting") return "Connecting…";
    if (call.status === "reconnecting") return "Reconnecting…";
    if (call.status === "failed") return "Call failed";
    if (call.status === "connected") return "Connected";
    return "Call ended";
}

function ControlButton({
    icon: Icon,
    label,
    onClick,
    active = false,
    danger = false,
    disabled = false
}) {
    return (
        <div className="flex w-16 flex-col items-center gap-1.5">
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                className={cn(
                    "flex size-14 items-center justify-center rounded-full text-white transition-colors disabled:opacity-40",
                    danger
                        ? "bg-danger hover:bg-danger/90"
                        : active
                          ? "bg-white/25 hover:bg-white/30"
                          : "bg-white/10 hover:bg-white/20"
                )}
                aria-label={label}
                aria-pressed={active}
            >
                <Icon className="size-5" />
            </button>
            <span className="text-[10px] font-medium text-white/70">{label}</span>
        </div>
    );
}

function IncomingCallModal() {
    const { incomingCall, acceptingCall, acceptCall, declineCall } = useCall();
    const incomingId = incomingCall?.id;

    useEffect(() => {
        if (!incomingId) return undefined;
        playRingtone(0.85);
        return stopRingtone;
    }, [incomingId]);

    if (!incomingCall) return null;

    const isVideo = incomingCall.type === "video";

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Incoming ${incomingCall.type} call`}
        >
            <div className="animate-fade-in w-full max-w-sm rounded-2xl border border-line bg-card p-6 text-center text-ink shadow-card">
                <p className="flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    <span className="size-2 animate-pulse rounded-full bg-success" />
                    Incoming {isVideo ? "video" : "voice"} call
                </p>

                <div className="mt-7 flex justify-center">
                    <Avatar
                        name={incomingCall.callerName}
                        src={incomingCall.callerPhotoURL}
                        uid={incomingCall.callerId}
                        size="xl"
                    />
                </div>

                <h2 className="mt-5 truncate text-2xl font-bold">
                    {incomingCall.callerName || "Someone"}
                </h2>
                <p className="mt-1 text-sm text-muted">
                    {isVideo ? "Video call" : "Voice call"} · Tap accept to join
                </p>

                <div className="mt-8 flex items-center justify-center gap-10">
                    <div className="flex flex-col items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                stopRingtone();
                                declineCall(incomingCall);
                            }}
                            disabled={acceptingCall}
                            className="flex size-16 items-center justify-center rounded-full bg-danger text-white transition-colors hover:bg-danger/90 disabled:opacity-50"
                            aria-label="Decline call"
                        >
                            <PhoneOff className="size-6" />
                        </button>
                        <span className="text-xs font-medium text-muted">Decline</span>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                stopRingtone();
                                acceptCall(incomingCall);
                            }}
                            disabled={acceptingCall}
                            className="flex size-16 items-center justify-center rounded-full bg-success text-white transition-colors hover:bg-success/90 disabled:opacity-50"
                            aria-label="Accept call"
                        >
                            {acceptingCall ? (
                                <Spinner className="size-6" />
                            ) : isVideo ? (
                                <Video className="size-6" />
                            ) : (
                                <Phone className="size-6" />
                            )}
                        </button>
                        <span className="text-xs font-medium text-muted">
                            {acceptingCall ? "Joining…" : "Accept"}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function ActiveCallOverlay() {
    const {
        activeCall,
        endCall,
        toggleMute,
        toggleCamera,
        switchCamera
    } = useCall();
    const callId = activeCall?.callId;
    const ringing = activeCall?.status === "ringing";

    useEffect(() => {
        if (!ringing) return undefined;
        playRingtone(0.45);
        return stopRingtone;
    }, [ringing, callId]);

    if (!activeCall) return null;

    const isVideo = activeCall.type === "video";
    const connected = activeCall.status === "connected";

    if (!isVideo) {
        return (
            <div className="fixed inset-0 z-[100] flex flex-col bg-[#0f1420] text-white">
                <StreamAudio stream={activeCall.remoteStream} />
                <div className="safe-top flex flex-1 flex-col items-center justify-center px-6">
                    <Avatar
                        name={activeCall.peer.name}
                        src={activeCall.peer.photoURL}
                        uid={activeCall.peer.uid}
                        size="xl"
                    />
                    <h1 className="mt-6 max-w-full truncate text-2xl font-bold">
                        {activeCall.peer.name}
                    </h1>
                    <p className="mt-1 flex items-center gap-2 text-sm text-white/60">
                        {connected ? (
                            <CallTimer connectedAt={activeCall.connectedAt} />
                        ) : (
                            statusText(activeCall)
                        )}
                    </p>
                    {activeCall.status === "reconnecting" ? (
                        <p className="mt-1 text-xs text-warn">Trying to reconnect…</p>
                    ) : null}
                </div>

                <div className="safe-bottom flex items-end justify-center gap-5 px-6 pb-10">
                    <ControlButton
                        icon={activeCall.muted ? MicOff : Mic}
                        label={activeCall.muted ? "Unmute" : "Mute"}
                        onClick={toggleMute}
                        active={activeCall.muted}
                    />
                    <ControlButton
                        icon={PhoneOff}
                        label="End"
                        onClick={endCall}
                        danger
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-[100] overflow-hidden bg-[#0b0f17] text-white">
            <StreamVideo
                stream={activeCall.remoteStream}
                className="absolute inset-0 size-full object-cover"
            />

            {!activeCall.remoteStream ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                    <Avatar
                        name={activeCall.peer.name}
                        src={activeCall.peer.photoURL}
                        uid={activeCall.peer.uid}
                        size="xl"
                    />
                    <p className="text-sm text-white/60">{statusText(activeCall)}</p>
                </div>
            ) : null}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-36 bg-gradient-to-b from-black/70 to-transparent" />

            <div className="safe-top absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                    <h1 className="truncate text-lg font-bold drop-shadow">
                        {activeCall.peer.name}
                    </h1>
                    <p className="flex items-center gap-2 text-xs text-white/75 drop-shadow">
                        {connected ? (
                            <>
                                <span className="size-1.5 rounded-full bg-success" />
                                <CallTimer connectedAt={activeCall.connectedAt} />
                            </>
                        ) : (
                            statusText(activeCall)
                        )}
                    </p>
                </div>
            </div>

            <div className="absolute right-4 top-20 z-10 h-40 w-28 overflow-hidden rounded-xl border border-white/20 bg-black/50 shadow-xl">
                {activeCall.cameraOff ? (
                    <div className="flex size-full flex-col items-center justify-center gap-1 text-white/50">
                        <VideoOff className="size-5" />
                        <span className="text-[10px]">Camera off</span>
                    </div>
                ) : (
                    <StreamVideo
                        stream={activeCall.localStream}
                        muted
                        mirrored={activeCall.facingMode === "user"}
                        className="size-full object-cover"
                    />
                )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/80 to-transparent" />

            <div className="safe-bottom absolute inset-x-0 bottom-0 flex items-end justify-center gap-3 px-4 pb-8">
                <ControlButton
                    icon={activeCall.muted ? MicOff : Mic}
                    label={activeCall.muted ? "Unmute" : "Mute"}
                    onClick={toggleMute}
                    active={activeCall.muted}
                />
                <ControlButton
                    icon={activeCall.cameraOff ? VideoOff : Video}
                    label={activeCall.cameraOff ? "Camera on" : "Camera off"}
                    onClick={toggleCamera}
                    active={activeCall.cameraOff}
                />
                <ControlButton
                    icon={SwitchCamera}
                    label="Flip"
                    onClick={switchCamera}
                />
                <ControlButton
                    icon={PhoneOff}
                    label="End"
                    onClick={endCall}
                    danger
                />
            </div>
        </div>
    );
}

export function CallOverlay() {
    const { activeCall, incomingCall } = useCall();
    const open = Boolean(activeCall || incomingCall);

    useEffect(() => {
        if (!open) return undefined;
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previous;
        };
    }, [open]);

    return (
        <>
            <IncomingCallModal />
            <ActiveCallOverlay />
        </>
    );
}

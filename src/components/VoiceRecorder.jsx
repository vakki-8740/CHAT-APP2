import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Send, Square, X } from "lucide-react";
import { VoicePlayer } from "./VoicePlayer";
import { extensionForMime, getAudioDuration, recorderMimeType } from "../utils/files";
import { formatClock } from "../utils/format";
import { limits } from "../config/app";
import { cn } from "../utils/cn";

export function VoiceRecorder({
    onRecorded,
    onActiveChange,
    maxSeconds = limits.voiceMaxSeconds,
    disabled = false,
    className
}) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState("");
    const [review, setReview] = useState(null);

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const startedAtRef = useRef(0);
    const cancelledRef = useRef(false);
    const limitReachedRef = useRef(false);
    const mountedRef = useRef(true);
    const reviewUrlRef = useRef("");

    function clearReview() {
        if (reviewUrlRef.current) {
            URL.revokeObjectURL(reviewUrlRef.current);
            reviewUrlRef.current = "";
        }
        setReview(null);
    }

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            window.clearInterval(timerRef.current);
            cancelledRef.current = true;
            if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
            try {
                if (recorderRef.current && recorderRef.current.state !== "inactive") {
                    recorderRef.current.stop();
                }
            } catch {
                /* ignore */
            }
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
        };
    }, []);

    async function start() {
        setError("");
        clearReview();
        if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
            setError("Voice recording is not supported in this browser.");
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;
            const mime = recorderMimeType();
            const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);

            chunksRef.current = [];
            cancelledRef.current = false;
            limitReachedRef.current = false;

            recorder.ondataavailable = (event) => {
                if (event.data?.size) chunksRef.current.push(event.data);
            };

            recorder.onstop = async () => {
                window.clearInterval(timerRef.current);
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
                setRecording(false);

                const elapsed = (Date.now() - startedAtRef.current) / 1000;
                if (
                    cancelledRef.current ||
                    !mountedRef.current ||
                    !chunksRef.current.length
                ) {
                    onActiveChange?.(false);
                    return;
                }

                const type = String(recorder.mimeType || mime || "audio/webm").split(";")[0];
                const blob = new Blob(chunksRef.current, { type });
                const extension = extensionForMime(type);
                const file = new File([blob], `voice-${Date.now()}.${extension}`, { type });
                const measured = await getAudioDuration(file);
                if (!mountedRef.current) return;

                const url = URL.createObjectURL(file);
                if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
                reviewUrlRef.current = url;
                setReview({
                    file,
                    duration: Math.min(
                        measured || Math.max(1, Math.round(elapsed)),
                        maxSeconds
                    ),
                    url,
                    limitReached: limitReachedRef.current
                });
            };

            recorder.start();
            recorderRef.current = recorder;
            startedAtRef.current = Date.now();
            setSeconds(0);
            setRecording(true);
            onActiveChange?.(true);
            timerRef.current = window.setInterval(() => {
                const elapsed = (Date.now() - startedAtRef.current) / 1000;
                setSeconds(Math.min(maxSeconds, Math.floor(elapsed)));
                if (elapsed >= maxSeconds && !limitReachedRef.current) {
                    limitReachedRef.current = true;
                    stop();
                }
            }, 250);
        } catch {
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
            setError("Microphone permission is required to record a voice note.");
        }
    }

    function stop() {
        if (recorderRef.current && recorderRef.current.state !== "inactive") {
            recorderRef.current.stop();
        }
    }

    function cancel() {
        cancelledRef.current = true;
        stop();
    }

    function retake() {
        clearReview();
        onActiveChange?.(false);
    }

    function send() {
        if (!review) return;
        const item = review;
        const url = reviewUrlRef.current;
        reviewUrlRef.current = "";
        setReview(null);
        if (url) URL.revokeObjectURL(url);
        onActiveChange?.(false);
        onRecorded?.({
            file: item.file,
            duration: item.duration,
            limitReached: item.limitReached
        });
    }

    if (review) {
        return (
            <div className={cn("w-full rounded-xl border border-line bg-bg p-2", className)}>
                <VoicePlayer src={review.url} duration={review.duration} />
                <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                        type="button"
                        onClick={retake}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-line bg-card text-xs font-semibold text-ink hover:border-accent hover:text-accent"
                    >
                        <RotateCcw className="size-3.5" /> Retake
                    </button>
                    <button
                        type="button"
                        onClick={send}
                        className="flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent text-xs font-semibold text-white"
                    >
                        <Send className="size-3.5" /> Send
                    </button>
                </div>
            </div>
        );
    }

    if (recording) {
        return (
            <div
                className={cn(
                    "flex w-full items-center gap-2 rounded-xl border border-danger/25 bg-danger/5 p-2",
                    className
                )}
            >
                <span className="flex min-w-[54px] items-center gap-1.5 text-xs font-bold tabular-nums text-danger">
                    <span className="animate-rec size-2 shrink-0 rounded-full bg-danger" />
                    {formatClock(seconds)}
                </span>
                <div className="min-w-0 flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-danger/15">
                        <span
                            className="block h-full rounded-full bg-danger transition-[width] duration-200"
                            style={{ width: `${Math.min((seconds / maxSeconds) * 100, 100)}%` }}
                        />
                    </div>
                    <p className="mt-1 text-[10px] font-medium text-muted">
                        Max {formatClock(maxSeconds)}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={cancel}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-muted hover:bg-card hover:text-ink"
                    aria-label="Cancel recording"
                >
                    <X className="size-3.5" />
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={stop}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-full bg-accent px-3 text-xs font-semibold text-white"
                    aria-label="Stop and preview recording"
                >
                    <Square className="size-3" fill="currentColor" />
                    Stop
                </button>
            </div>
        );
    }

    return (
        <div className={cn("flex min-w-0 flex-col", className)}>
            <button
                type="button"
                onClick={start}
                disabled={disabled}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
                aria-label="Record a voice message"
                title="Record voice message"
            >
                <Mic className="size-5" />
                Record
            </button>
            {error ? (
                <p className="mt-1 text-right text-2xs text-danger">{error}</p>
            ) : null}
        </div>
    );
}

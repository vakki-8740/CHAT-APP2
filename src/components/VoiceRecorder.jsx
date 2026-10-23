import { useEffect, useRef, useState } from "react";
import { Mic, Square, X } from "lucide-react";
import { extensionForMime, getAudioDuration, recorderMimeType } from "../utils/files";
import { formatClock } from "../utils/format";
import { cn } from "../utils/cn";

export function VoiceRecorder({ onRecorded, disabled = false }) {
    const [recording, setRecording] = useState(false);
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState("");

    const recorderRef = useRef(null);
    const streamRef = useRef(null);
    const chunksRef = useRef([]);
    const timerRef = useRef(null);
    const startedAtRef = useRef(0);
    const cancelledRef = useRef(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
            window.clearInterval(timerRef.current);
            cancelledRef.current = true;
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

            recorder.ondataavailable = (event) => {
                if (event.data?.size) chunksRef.current.push(event.data);
            };

            recorder.onstop = async () => {
                window.clearInterval(timerRef.current);
                stream.getTracks().forEach((track) => track.stop());
                streamRef.current = null;
                setRecording(false);

                const elapsed = (Date.now() - startedAtRef.current) / 1000;
                if (cancelledRef.current || !mountedRef.current || !chunksRef.current.length)
                    return;

                const type = String(recorder.mimeType || mime || "audio/webm").split(";")[0];
                const blob = new Blob(chunksRef.current, { type });
                const extension = extensionForMime(type);
                const file = new File([blob], `voice-${Date.now()}.${extension}`, { type });
                const measured = await getAudioDuration(file);
                if (!mountedRef.current) return;
                onRecorded?.({
                    file,
                    duration: measured || Math.max(1, Math.round(elapsed))
                });
            };

            recorder.start();
            recorderRef.current = recorder;
            startedAtRef.current = Date.now();
            setSeconds(0);
            setRecording(true);
            timerRef.current = window.setInterval(() => {
                setSeconds(Math.floor((Date.now() - startedAtRef.current) / 1000));
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

    if (recording) {
        return (
            <div className="flex items-center gap-2 rounded-full border border-line bg-bg px-2 py-1.5">
                <span className="ml-1 flex items-center gap-1.5 text-xs font-semibold text-danger">
                    <span className="animate-rec size-2 rounded-full bg-danger" />
                    {formatClock(seconds)}
                </span>
                <button
                    type="button"
                    onClick={cancel}
                    className="flex size-8 items-center justify-center rounded-full text-muted hover:bg-card hover:text-ink"
                    aria-label="Cancel recording"
                >
                    <X className="size-4" />
                </button>
                <button
                    type="button"
                    onClick={stop}
                    className="flex size-9 items-center justify-center rounded-full bg-accent text-white"
                    aria-label="Stop and send recording"
                >
                    <Square className="size-3.5" fill="currentColor" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-end">
            <button
                type="button"
                onClick={start}
                disabled={disabled}
                className={cn(
                    "flex size-11 items-center justify-center rounded-full bg-accent text-white transition-opacity disabled:opacity-40"
                )}
                aria-label="Record a voice message"
                title="Record voice message"
            >
                <Mic className="size-5" />
            </button>
            {error ? <p className="mt-1 max-w-[220px] text-right text-2xs text-danger">{error}</p> : null}
        </div>
    );
}

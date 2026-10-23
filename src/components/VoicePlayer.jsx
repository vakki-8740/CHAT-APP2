import { useEffect, useRef, useState } from "react";
import { AlertCircle, Pause, Play } from "lucide-react";
import { formatClock } from "../utils/format";
import { cn } from "../utils/cn";

export function VoicePlayer({ src, duration = 0, tone = "default" }) {
    const audioRef = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [current, setCurrent] = useState(0);
    const [total, setTotal] = useState(Number(duration) || 0);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        setPlaying(false);
        setCurrent(0);
        setFailed(false);
        setTotal(Number(duration) || 0);
    }, [src, duration]);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return undefined;

        const onTime = () => setCurrent(audio.currentTime || 0);
        const onMeta = () => {
            if (Number.isFinite(audio.duration) && audio.duration > 0) setTotal(audio.duration);
        };
        const onEnd = () => {
            setPlaying(false);
            setCurrent(0);
        };
        const onError = () => {
            setFailed(true);
            setPlaying(false);
        };

        audio.addEventListener("timeupdate", onTime);
        audio.addEventListener("loadedmetadata", onMeta);
        audio.addEventListener("ended", onEnd);
        audio.addEventListener("error", onError);
        return () => {
            audio.removeEventListener("timeupdate", onTime);
            audio.removeEventListener("loadedmetadata", onMeta);
            audio.removeEventListener("ended", onEnd);
            audio.removeEventListener("error", onError);
        };
    }, []);

    async function toggle() {
        const audio = audioRef.current;
        if (!audio || !src) return;
        if (playing) {
            audio.pause();
            setPlaying(false);
            return;
        }
        try {
            await audio.play();
            setPlaying(true);
            setFailed(false);
        } catch {
            setFailed(true);
        }
    }

    function seek(event) {
        const audio = audioRef.current;
        if (!audio || !total) return;
        const rect = event.currentTarget.getBoundingClientRect();
        const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
        audio.currentTime = ratio * total;
        setCurrent(audio.currentTime);
    }

    const progress = total > 0 ? Math.min((current / total) * 100, 100) : 0;
    const onAccent = tone === "onAccent";

    return (
        <div className={cn("flex min-w-[190px] items-center gap-2.5 py-0.5")}>
            <audio ref={audioRef} src={src} preload="metadata" />
            <button
                type="button"
                onClick={toggle}
                className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors",
                    onAccent
                        ? "bg-white/20 text-white hover:bg-white/30"
                        : "bg-accent text-white hover:opacity-90"
                )}
                aria-label={playing ? "Pause voice message" : "Play voice message"}
            >
                {playing ? (
                    <Pause className="size-3.5" fill="currentColor" />
                ) : (
                    <Play className="ml-0.5 size-3.5" fill="currentColor" />
                )}
            </button>

            <button
                type="button"
                onClick={seek}
                className="flex flex-1 flex-col gap-1 py-1"
                aria-label="Seek voice message"
            >
                <span
                    className={cn(
                        "block h-1.5 w-full overflow-hidden rounded-full",
                        onAccent ? "bg-white/25" : "bg-line"
                    )}
                >
                    <span
                        className={cn(
                            "block h-full rounded-full",
                            onAccent ? "bg-white" : "bg-accent"
                        )}
                        style={{ width: `${progress}%` }}
                    />
                </span>
            </button>

            <span
                className={cn(
                    "shrink-0 text-[10px] tabular-nums",
                    onAccent ? "text-white/75" : "text-muted"
                )}
            >
                {failed ? (
                    <AlertCircle className="size-3.5" aria-label="Audio failed to load" />
                ) : (
                    `${formatClock(current)} / ${formatClock(total)}`
                )}
            </span>
        </div>
    );
}

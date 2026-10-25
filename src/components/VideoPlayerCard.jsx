import { useEffect, useRef, useState } from "react";
import { Download, Film, RefreshCw, VideoOff } from "lucide-react";
import { resolveVideoStreamUrl } from "../services/videoUploadService";
import { formatBytes } from "../utils/files";
import { formatClock } from "../utils/format";
import { cn } from "../utils/cn";

export function VideoPlayerCard({
    src,
    poster = "",
    fileName = "",
    fileSize = 0,
    duration = 0,
    uploading = false,
    uploadProgress = null,
    tone = "default",
    className = ""
}) {
    const videoRef = useRef(null);
    const [failed, setFailed] = useState(false);
    const [retryTick, setRetryTick] = useState(0);

    const streamUrl = resolveVideoStreamUrl(src);
    const downloadUrl = resolveVideoStreamUrl(src, {
        download: true,
        fileName: fileName || "video.mp4"
    });

    useEffect(() => {
        setFailed(false);
    }, [src]);

    const onAccent = tone === "onAccent";
    const effectiveSrc =
        streamUrl && retryTick > 0 && !streamUrl.startsWith("blob:")
            ? `${streamUrl}${streamUrl.includes("?") ? "&" : "?"}r=${retryTick}`
            : streamUrl;

    function handleRetry() {
        setFailed(false);
        setRetryTick((v) => v + 1);
        window.setTimeout(() => {
            videoRef.current?.load?.();
        }, 30);
    }

    if (!streamUrl) {
        return (
            <div
                className={cn(
                    "flex items-center gap-2 rounded-xl px-3 py-2 text-xs italic",
                    onAccent ? "bg-black/15 text-white/85" : "bg-bg text-muted",
                    className
                )}
            >
                <VideoOff className="size-4 shrink-0" />
                <span>Video unavailable</span>
            </div>
        );
    }

    return (
        <div className={cn("w-64 max-w-full sm:w-72", className)}>
            <div className="relative overflow-hidden rounded-xl bg-black">
                {failed ? (
                    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 px-4 py-6 text-center text-white/90">
                        <VideoOff className="size-6 opacity-80" />
                        <p className="text-xs font-medium">Could not play video right now</p>
                        <button
                            type="button"
                            onClick={handleRetry}
                            className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white hover:bg-white/25"
                        >
                            <RefreshCw className="size-3" /> Retry
                        </button>
                    </div>
                ) : (
                    <video
                        ref={videoRef}
                        src={effectiveSrc}
                        poster={poster || undefined}
                        controls={!uploading}
                        controlsList="nodownload"
                        playsInline
                        preload="metadata"
                        onContextMenu={(e) => e.preventDefault()}
                        onError={() => {
                            if (!uploading) setFailed(true);
                        }}
                        className="max-h-80 w-full bg-black object-contain"
                    />
                )}

                {uploading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 px-4 text-white backdrop-blur-[1px]">
                        <div className="w-full max-w-[180px] overflow-hidden rounded-full bg-white/25 h-2">
                            <div
                                className="h-full rounded-full bg-white transition-all duration-200"
                                style={{
                                    width: `${Math.max(4, Number(uploadProgress || 0))}%`
                                }}
                            />
                        </div>
                        <p className="text-xs font-semibold tabular-nums">
                            Uploading {Math.round(Number(uploadProgress || 0))}%
                        </p>
                    </div>
                ) : null}
            </div>

            <div
                className={cn(
                    "mt-1.5 flex items-center justify-between gap-2 text-[11px]",
                    onAccent ? "text-white/85" : "text-muted"
                )}
            >
                <div className="flex min-w-0 items-center gap-1.5">
                    <Film className="size-3.5 shrink-0" />
                    <span className="truncate font-medium">
                        {fileName || "Video"}
                    </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {duration > 0 ? (
                        <span className="tabular-nums">{formatClock(duration)}</span>
                    ) : null}
                    {fileSize > 0 ? (
                        <span className="tabular-nums">{formatBytes(fileSize)}</span>
                    ) : null}
                    {!uploading && !streamUrl.startsWith("blob:") ? (
                        <a
                            href={downloadUrl}
                            download={fileName || "video.mp4"}
                            target="_blank"
                            rel="noreferrer"
                            className={cn(
                                "inline-flex size-6 items-center justify-center rounded-full transition-colors",
                                onAccent
                                    ? "bg-white/15 text-white hover:bg-white/25"
                                    : "border border-line bg-bg text-ink hover:border-accent hover:text-accent"
                            )}
                            title="Download video"
                            aria-label="Download video"
                        >
                            <Download className="size-3" />
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

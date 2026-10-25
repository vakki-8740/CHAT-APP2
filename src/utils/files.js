const MIME_EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/webm": "webm",
    "video/webm": "webm",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/x-m4v": "m4v",
    "video/x-matroska": "mkv",
    "video/ogg": "ogv",
    "video/x-msvideo": "avi",
    "video/mpeg": "mpeg",
    "video/3gpp": "3gp",
    "video/3gpp2": "3g2",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/ogg": "ogg",
    "application/ogg": "ogg",
    "audio/opus": "opus",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/wave": "wav",
    "audio/aac": "aac",
    "audio/3gpp": "3gp"
};

export function extensionForMime(mime) {
    const value = String(mime || "").split(";")[0].trim().toLowerCase();
    if (MIME_EXTENSIONS[value]) return MIME_EXTENSIONS[value];
    if (value.startsWith("image/")) return "img";
    if (value.startsWith("video/")) return "mp4";
    if (value.startsWith("audio/")) return "audio";
    return "bin";
}

export function recorderMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
        "audio/mp4",
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus"
    ];
    return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

async function decodeDurationFallback(source) {
    const AudioCtx = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx || typeof source?.arrayBuffer !== "function") return 0;
    const context = new AudioCtx();
    try {
        const buffer = await source.arrayBuffer();
        const decoded = await context.decodeAudioData(buffer.slice(0));
        return Number.isFinite(decoded.duration) && decoded.duration > 0
            ? decoded.duration
            : 0;
    } catch {
        return 0;
    } finally {
        context.close?.().catch?.(() => {});
    }
}

export async function getAudioDuration(source) {
    if (typeof Audio === "undefined" || typeof URL.createObjectURL !== "function") {
        return 0;
    }
    const viaElement = await new Promise((resolve) => {
        const url = URL.createObjectURL(source);
        const audio = new Audio();
        let settled = false;
        const done = (value) => {
            if (settled) return;
            settled = true;
            URL.revokeObjectURL(url);
            resolve(Number.isFinite(value) && value > 0 ? value : 0);
        };
        audio.preload = "metadata";
        audio.onloadedmetadata = () => {
            if (audio.duration === Infinity) {
                audio.ontimeupdate = () => {
                    audio.ontimeupdate = null;
                    done(audio.duration);
                };
                audio.currentTime = 1e101;
                return;
            }
            done(audio.duration);
        };
        audio.onerror = () => done(0);
        audio.src = url;
    });

    if (viaElement > 0) return viaElement;
    return decodeDurationFallback(source);
}

/**
 * Extracts duration (seconds) and a lightweight compressed JPEG poster data URL
 * (~10-25 KB) from a local video File so video cards show a thumbnail immediately.
 */
export async function extractVideoMetadata(file) {
    if (typeof document === "undefined" || typeof URL.createObjectURL !== "function") {
        return { duration: 0, posterUrl: "" };
    }

    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const video = document.createElement("video");
        let settled = false;

        const finish = (result) => {
            if (settled) return;
            settled = true;
            window.clearTimeout(timer);
            video.removeAttribute("src");
            video.load();
            URL.revokeObjectURL(objectUrl);
            resolve(result);
        };

        const timer = window.setTimeout(() => {
            finish({ duration: 0, posterUrl: "" });
        }, 6000);

        video.preload = "metadata";
        video.muted = true;
        video.playsInline = true;

        const capturePoster = (duration) => {
            try {
                const vw = video.videoWidth || 0;
                const vh = video.videoHeight || 0;
                if (!vw || !vh) {
                    finish({ duration, posterUrl: "" });
                    return;
                }
                const maxSide = 440;
                const scale = Math.min(1, maxSide / Math.max(vw, vh));
                const width = Math.max(1, Math.round(vw * scale));
                const height = Math.max(1, Math.round(vh * scale));
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext("2d");
                if (!ctx) {
                    finish({ duration, posterUrl: "" });
                    return;
                }
                ctx.drawImage(video, 0, 0, width, height);
                const posterUrl = canvas.toDataURL("image/jpeg", 0.65);
                finish({
                    duration,
                    posterUrl: posterUrl.length < 60_000 ? posterUrl : ""
                });
            } catch {
                finish({ duration, posterUrl: "" });
            }
        };

        video.onloadedmetadata = () => {
            const rawDuration =
                Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
            const targetTime = rawDuration > 0.6 ? Math.min(1.0, rawDuration * 0.15) : 0.05;

            video.onseeked = () => capturePoster(rawDuration);
            try {
                video.currentTime = targetTime;
            } catch {
                capturePoster(rawDuration);
            }
        };

        video.onerror = () => finish({ duration: 0, posterUrl: "" });
        video.src = objectUrl;
    });
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

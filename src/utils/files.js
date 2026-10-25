const MIME_EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/webm": "webm",
    "video/webm": "webm",
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
    if (value.startsWith("audio/")) return "audio";
    return "bin";
}

export function recorderMimeType() {
    if (typeof MediaRecorder === "undefined") return "";
    const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
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

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

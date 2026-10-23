const MIME_EXTENSIONS = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "audio/webm": "webm",
    "audio/mp4": "m4a",
    "audio/x-m4a": "m4a",
    "audio/m4a": "m4a",
    "audio/mpeg": "mp3",
    "audio/ogg": "ogg",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/aac": "aac",
    "audio/3gpp": "3gp"
};

export function extensionForMime(mime) {
    const value = String(mime || "").split(";")[0].trim();
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

export function getAudioDuration(source) {
    if (typeof Audio === "undefined" || typeof URL.createObjectURL !== "function") {
        return Promise.resolve(0);
    }
    return new Promise((resolve) => {
        const url = URL.createObjectURL(source);
        const audio = new Audio();
        const done = (value) => {
            URL.revokeObjectURL(url);
            resolve(Number.isFinite(value) && value > 0 ? value : 0);
        };
        audio.preload = "metadata";
        audio.onloadedmetadata = () => done(audio.duration);
        audio.onerror = () => done(0);
        audio.src = url;
    });
}

export function formatBytes(bytes) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`;
}

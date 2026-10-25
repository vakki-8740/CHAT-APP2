import { AppError } from "../services/errors";
import { limits } from "../config/app";

const MAX_IMAGE_DATA_URL_LENGTH = 780_000;
const MAX_AUDIO_DATA_URL_LENGTH = 900_000;
const DIRECT_AUDIO_MAX_BYTES = 650 * 1024;
const DIRECT_GIF_MAX_BYTES = 550 * 1024;

const UNIVERSAL_AUDIO_MIMES = new Set([
    "audio/mpeg",
    "audio/mp3",
    "audio/mp4",
    "audio/x-m4a",
    "audio/m4a",
    "audio/aac"
]);

function normalizeAudioMime(rawMime) {
    const mime = String(rawMime || "").split(";")[0].trim().toLowerCase();
    if (mime === "audio/mp3") return "audio/mpeg";
    if (mime === "audio/x-m4a" || mime === "audio/m4a") return "audio/mp4";
    if (mime === "video/webm") return "audio/webm";
    if (mime === "application/ogg") return "audio/ogg";
    if (mime === "audio/x-wav" || mime === "audio/wave") return "audio/wav";
    return mime || "audio/mpeg";
}

export function blobToDataUrl(blob, overrideMime = "") {
    const target =
        overrideMime && blob.type !== overrideMime
            ? new Blob([blob], { type: overrideMime })
            : blob;

    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string") {
                resolve(reader.result);
            } else {
                reject(new AppError("storage/encode-failed", "Could not read this file."));
            }
        };
        reader.onerror = () =>
            reject(new AppError("storage/encode-failed", "Could not read this file."));
        reader.readAsDataURL(target);
    });
}

export function dataUrlToObjectUrl(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return "";
    const commaIndex = dataUrl.indexOf(",");
    if (commaIndex === -1) return "";

    const header = dataUrl.slice(5, commaIndex);
    const isBase64 = header.includes(";base64");
    const mime = header.split(";")[0] || "application/octet-stream";
    const body = dataUrl.slice(commaIndex + 1);

    try {
        if (!isBase64) {
            const textBytes = new TextEncoder().encode(decodeURIComponent(body));
            return URL.createObjectURL(new Blob([textBytes], { type: mime }));
        }
        const binary = atob(body);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i += 1) {
            bytes[i] = binary.charCodeAt(i);
        }
        return URL.createObjectURL(new Blob([bytes], { type: mime }));
    } catch {
        return "";
    }
}

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file);
        const image = new Image();
        image.onload = () => {
            URL.revokeObjectURL(objectUrl);
            resolve(image);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new AppError("storage/bad-image", "Could not read this image."));
        };
        image.src = objectUrl;
    });
}

let cachedWebpSupport = null;

function supportsWebpEncode() {
    if (cachedWebpSupport !== null) return cachedWebpSupport;
    if (typeof document === "undefined") return false;
    try {
        const canvas = document.createElement("canvas");
        canvas.width = 2;
        canvas.height = 2;
        cachedWebpSupport = canvas
            .toDataURL("image/webp", 0.8)
            .startsWith("data:image/webp");
    } catch {
        cachedWebpSupport = false;
    }
    return cachedWebpSupport;
}

function renderScaledCanvas(image, maxSide, fillWhite) {
    const naturalW = image.naturalWidth || image.width || 1;
    const naturalH = image.naturalHeight || image.height || 1;
    const scale = Math.min(1, maxSide / Math.max(naturalW, naturalH));
    const width = Math.max(1, Math.round(naturalW * scale));
    const height = Math.max(1, Math.round(naturalH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
        throw new AppError("storage/bad-image", "Could not prepare this image.");
    }

    if (fillWhite) {
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);
    return canvas;
}

export async function encodeChatImageDataUrl(file, { onProgress } = {}) {
    onProgress?.(15);
    const rawMime = String(file.type || "").split(";")[0].trim().toLowerCase();

    if (rawMime === "image/gif" && file.size > 0 && file.size <= DIRECT_GIF_MAX_BYTES) {
        const gifUrl = await blobToDataUrl(file, "image/gif");
        if (gifUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
            onProgress?.(100);
            return gifUrl;
        }
    }

    const image = await loadImage(file);
    const useWebp = supportsWebpEncode();
    const outputMime = useWebp ? "image/webp" : "image/jpeg";
    const fillWhite = outputMime === "image/jpeg";

    let smallest = "";
    const maxSides = [1600, 1280, 1024, 800, 640];
    const qualities = [0.84, 0.75, 0.65, 0.54];

    for (let s = 0; s < maxSides.length; s += 1) {
        const canvas = renderScaledCanvas(image, maxSides[s], fillWhite);
        onProgress?.(Math.min(90, 25 + (s + 1) * 12));
        for (const quality of qualities) {
            const dataUrl = canvas.toDataURL(outputMime, quality);
            if (!smallest || dataUrl.length < smallest.length) {
                smallest = dataUrl;
            }
            if (dataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH) {
                onProgress?.(100);
                return dataUrl;
            }
        }
    }

    if (smallest && smallest.length <= MAX_IMAGE_DATA_URL_LENGTH) {
        onProgress?.(100);
        return smallest;
    }

    throw new AppError(
        "storage/image-too-large",
        "This photo is too complex to compress. Please try another image."
    );
}

function chooseMp3Bitrate(durationSeconds) {
    if (durationSeconds <= 65) return 48;
    if (durationSeconds <= 130) return 32;
    if (durationSeconds <= 190) return 24;
    return 16;
}

async function decodeAndResampleMono(arrayBuffer, targetSampleRate) {
    const AudioCtx =
        globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioCtx || typeof OfflineAudioContext === "undefined") {
        throw new Error("Web Audio API unavailable");
    }

    const context = new AudioCtx();
    let decoded;
    try {
        decoded = await context.decodeAudioData(arrayBuffer.slice(0));
    } finally {
        context.close?.().catch?.(() => {});
    }

    const maxDuration = limits.voiceMaxSeconds + 1;
    const duration = Math.min(decoded.duration || 0, maxDuration);
    if (!duration || duration <= 0) {
        throw new Error("Decoded audio is empty");
    }

    const frameCount = Math.max(1, Math.ceil(duration * targetSampleRate));
    const offline = new OfflineAudioContext(1, frameCount, targetSampleRate);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start(0);
    const rendered = await offline.startRendering();
    const channel = rendered.getChannelData(0);

    const pcm = new Int16Array(channel.length);
    for (let i = 0; i < channel.length; i += 1) {
        const clamped = Math.max(-1, Math.min(1, channel[i]));
        pcm[i] = clamped < 0 ? Math.round(clamped * 32768) : Math.round(clamped * 32767);
    }

    return { pcm, duration };
}

async function transcodeToMp3DataUrl(file, { onProgress } = {}) {
    const sampleRate = 16000;
    onProgress?.(15);
    const buffer = await file.arrayBuffer();
    const { pcm, duration } = await decodeAndResampleMono(buffer, sampleRate);
    onProgress?.(40);

    const lameModule = await import("@breezystack/lamejs");
    const Mp3Encoder = lameModule.Mp3Encoder || lameModule.default?.Mp3Encoder;
    if (!Mp3Encoder) {
        throw new Error("MP3 encoder unavailable");
    }

    const kbps = chooseMp3Bitrate(duration);
    const encoder = new Mp3Encoder(1, sampleRate, kbps);
    const chunks = [];
    const blockSize = 1152;
    const yieldEvery = blockSize * 45;
    let nextYield = yieldEvery;

    for (let offset = 0; offset < pcm.length; offset += blockSize) {
        const slice = pcm.subarray(offset, offset + blockSize);
        const encoded = encoder.encodeBuffer(slice);
        if (encoded.length > 0) {
            chunks.push(new Uint8Array(encoded));
        }
        if (offset >= nextYield) {
            nextYield += yieldEvery;
            onProgress?.(Math.min(92, 40 + Math.round((offset / pcm.length) * 52)));
            await new Promise((resolve) => setTimeout(resolve, 0));
        }
    }

    const tail = encoder.flush();
    if (tail.length > 0) {
        chunks.push(new Uint8Array(tail));
    }

    const mp3Blob = new Blob(chunks, { type: "audio/mpeg" });
    const dataUrl = await blobToDataUrl(mp3Blob, "audio/mpeg");
    if (dataUrl.length > MAX_AUDIO_DATA_URL_LENGTH) {
        throw new AppError(
            "storage/audio-too-large",
            "Voice note is too long. Please keep voice notes under 5 minutes."
        );
    }

    onProgress?.(100);
    return dataUrl;
}

export async function encodeVoiceDataUrl(file, { onProgress } = {}) {
    const rawMime = String(file.type || "").split(";")[0].trim().toLowerCase();
    const normalizedMime = normalizeAudioMime(rawMime);

    if (
        UNIVERSAL_AUDIO_MIMES.has(rawMime) &&
        file.size > 0 &&
        file.size <= DIRECT_AUDIO_MAX_BYTES
    ) {
        onProgress?.(50);
        const directUrl = await blobToDataUrl(file, normalizedMime);
        if (directUrl.length <= MAX_AUDIO_DATA_URL_LENGTH) {
            onProgress?.(100);
            return directUrl;
        }
    }

    try {
        return await transcodeToMp3DataUrl(file, { onProgress });
    } catch (error) {
        if (error instanceof AppError) throw error;
        if (file.size > 0 && file.size <= DIRECT_AUDIO_MAX_BYTES) {
            const fallbackUrl = await blobToDataUrl(file, normalizedMime);
            if (fallbackUrl.length <= MAX_AUDIO_DATA_URL_LENGTH) {
                onProgress?.(100);
                return fallbackUrl;
            }
        }
        throw new AppError(
            "storage/audio-encode-failed",
            "Could not process this audio file. Try recording directly or choosing an MP3/M4A under 5 minutes."
        );
    }
}

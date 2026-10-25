import { limits } from "../config/app";

export function normalizeMobile(raw) {
    return String(raw || "").replace(/[^\d]/g, "");
}

export function isValidMobile(raw) {
    const digits = normalizeMobile(raw);
    return digits.length >= 7 && digits.length <= 15;
}

export function validateDisplayName(name) {
    const value = String(name || "").trim();
    if (!value) return "User name is required.";
    if (value.length < 2) return "User name must be at least 2 characters.";
    if (value.length > limits.displayNameMaxLength)
        return `User name must be under ${limits.displayNameMaxLength} characters.`;
    return "";
}

export function getPasswordStrength(password) {
    const value = String(password || "");
    let score = 0;
    if (value.length >= 8) score += 1;
    if (/[0-9]/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    if (value.length >= 12) score += 1;
    return Math.min(score, 4);
}

export function validatePassword(password) {
    const value = String(password || "");
    if (!value) return "Password is required.";
    if (value.length < 8) return "Password must be at least 8 characters.";
    if (!/[0-9]/.test(value)) return "Password must contain a number.";
    return "";
}

export function validateBio(bio) {
    const value = String(bio || "");
    if (value.length > limits.bioMaxLength)
        return `About must be under ${limits.bioMaxLength} characters.`;
    return "";
}

const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "webp", "gif"]);
const AUDIO_EXTS = new Set(["webm", "mp4", "m4a", "mp3", "ogg", "opus", "wav", "aac", "3gp"]);

export function validateFile(file, kind) {
    if (!file) return "No file selected.";
    const isImage = kind === "image";
    const types = isImage ? limits.imageTypes : limits.audioTypes;
    const maxBytes = isImage ? limits.imageMaxBytes : limits.audioMaxBytes;
    const mime = String(file.type || "").split(";")[0].trim().toLowerCase();
    const ext = String(file.name || "")
        .split(".")
        .pop()
        .toLowerCase();
    const extAllowed = isImage ? IMAGE_EXTS.has(ext) : AUDIO_EXTS.has(ext);
    const mimeEmpty = !mime || mime === "application/octet-stream";

    if (types.length && !(mimeEmpty ? extAllowed : types.includes(mime)))
        return isImage ? "Unsupported image format." : "Unsupported audio format.";
    if (file.size > maxBytes)
        return `File is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB).`;
    return "";
}

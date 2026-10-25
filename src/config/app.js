// Branding placeholders. The project owner supplies the real logo + name later.
export const branding = {
    name: import.meta.env.VITE_APP_NAME?.trim() || "Personal Chat",
    logoUrl: import.meta.env.VITE_APP_LOGO_URL?.trim() || "/logo-mark.svg"
};

// App lock PIN required every time the project is opened.
export const APP_LOCK_PIN = "272026";

// Limits used across chat, voice pack, and video pack.
export const limits = {
    imageMaxBytes: 10 * 1024 * 1024, // 10 MB
    audioMaxBytes: 15 * 1024 * 1024, // 15 MB
    videoMaxBytes: 200 * 1024 * 1024, // 200 MB
    voiceMaxSeconds: 5 * 60,
    imageTypes: ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"],
    audioTypes: [
        "audio/webm",
        "video/webm",
        "audio/mp4",
        "audio/mpeg",
        "audio/mp3",
        "audio/ogg",
        "application/ogg",
        "audio/opus",
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/x-m4a",
        "audio/m4a",
        "audio/aac",
        "audio/3gpp"
    ],
    videoTypes: [
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "video/x-m4v",
        "video/x-matroska",
        "video/3gpp",
        "video/3gpp2",
        "video/ogg",
        "video/x-msvideo",
        "video/mpeg"
    ],
    messageMaxLength: 4000,
    bioMaxLength: 160,
    displayNameMaxLength: 40
};

// Branding placeholders. The project owner supplies the real logo + name later.
export const branding = {
    name: import.meta.env.VITE_APP_NAME?.trim() || "Personal Chat",
    logoUrl: import.meta.env.VITE_APP_LOGO_URL?.trim() || "/logo-mark.png"
};

// Limits used across chat + voice pack.
export const limits = {
    imageMaxBytes: 10 * 1024 * 1024, // 10 MB
    audioMaxBytes: 15 * 1024 * 1024, // 15 MB
    voiceMaxSeconds: 5 * 60,
    imageTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
    audioTypes: [
        "audio/webm",
        "audio/mp4",
        "audio/mpeg",
        "audio/ogg",
        "audio/wav",
        "audio/x-wav",
        "audio/x-m4a",
        "audio/m4a",
        "audio/aac",
        "audio/3gpp"
    ],
    messageMaxLength: 4000,
    bioMaxLength: 160,
    displayNameMaxLength: 40
};

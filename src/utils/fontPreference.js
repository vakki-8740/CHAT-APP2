import { DEFAULT_FONT_ID, getAppFont } from "../config/fonts";

const STORAGE_PREFIX = "chat-app:font:";

export function getSavedFont(uid) {
    if (typeof window === "undefined" || !uid) return DEFAULT_FONT_ID;
    try {
        return getAppFont(window.localStorage.getItem(`${STORAGE_PREFIX}${uid}`)).id;
    } catch {
        return DEFAULT_FONT_ID;
    }
}

export function saveFont(uid, fontId) {
    if (typeof window === "undefined" || !uid) return false;
    const selected = getAppFont(fontId);
    try {
        window.localStorage.setItem(`${STORAGE_PREFIX}${uid}`, selected.id);
        return true;
    } catch {
        return false;
    }
}

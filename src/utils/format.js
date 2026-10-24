export function toDate(value) {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value.toDate === "function") return value.toDate();
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function formatTime(value) {
    const d = toDate(value);
    if (!d) return "";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatClock(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function formatListTime(value) {
    const d = toDate(value);
    if (!d) return "";
    const now = new Date();
    const sameDay = d.toDateString() === now.toDateString();
    if (sameDay) return formatTime(d);
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    const diffDays = Math.floor((now - d) / 86400000);
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
    return d.toLocaleDateString([], { day: "2-digit", month: "short" });
}

export function formatFullDate(value) {
    const d = toDate(value);
    if (!d) return "—";
    return d.toLocaleDateString([], { day: "2-digit", month: "long", year: "numeric" });
}

export function formatDayLabel(value) {
    const d = toDate(value);
    if (!d) return "";
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return "Today";
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
    return d.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" });
}

export function initialsFrom(name) {
    if (!name) return "?";
    return name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() || "")
        .join("");
}

export const MAX_REACTIONS_PER_USER = 5;

export const REACTION_PALETTE = [
    "😀","😅","😂","🤣","🥰","☺️","👍","😊","😍","🤩",
    "😘","😚","🤪","😜","😝","😛","😋","🤤","🥲","🙂",
    "😭","🥹","🥺","😔","😥","😢","☹️","🫤","😕","😓",
    "🙄","😤","😠","🤨","🧐","🙈","🙊","😹","❤️","💝",
    "❤️‍🩹","💞","👀","🫦","👄","🙏","🤦","🤷","🙅","🙆",
    "🙎","🙋","💁","💐","🌸","🪷","🥀","👩‍❤️‍👨"
];

export const EMOJI_PALETTE = [
    "😀","😄","😁","😆","😅","😂","🙂","😉","😊","😍",
    "😘","😜","🤔","🤗","🤩","😎","😢","😭","😡","😮",
    "👍","👎","👏","🙏","💪","🙌","👌","✌️","🔥","✨",
    "❤️","🧡","💚","💙","💜","🎉","🎁","🌹","☀️","🌙",
    "🍕","☕","⚽","🏆","📌","✅","❌","⏰","📷","🎵"
];

export function userReactionsFor(reactions, uid) {
    if (!reactions || !uid) return [];
    const value = reactions[uid];
    const list = Array.isArray(value) ? value : value ? [value] : [];
    return [...new Set(list.filter((item) => typeof item === "string" && item))].slice(
        0,
        MAX_REACTIONS_PER_USER
    );
}

export function toggleUserReaction(reactionMap, uid, emoji) {
    const current = userReactionsFor(reactionMap, uid);
    const existingIndex = current.indexOf(emoji);
    const added = existingIndex < 0;
    if (added && current.length >= MAX_REACTIONS_PER_USER) {
        return { ok: false, added: false, reactions: current, reactionMap };
    }

    const reactions =
        existingIndex >= 0 ? current.filter((item) => item !== emoji) : [...current, emoji];
    const nextMap = { ...reactionMap };
    if (reactions.length) nextMap[uid] = reactions;
    else delete nextMap[uid];
    return { ok: true, added, reactions, reactionMap: nextMap };
}

export function mergeReactions(reactions) {
    if (!reactions || typeof reactions !== "object") return [];
    const grouped = {};
    for (const [uid, value] of Object.entries(reactions)) {
        const emojiList = Array.isArray(value) ? value : value ? [value] : [];
        for (const emoji of new Set(emojiList)) {
            if (typeof emoji !== "string" || !emoji) continue;
            if (!grouped[emoji]) grouped[emoji] = { emoji, count: 0, uids: [] };
            grouped[emoji].count += 1;
            grouped[emoji].uids.push(uid);
        }
    }
    return Object.values(grouped).sort((a, b) => b.count - a.count);
}

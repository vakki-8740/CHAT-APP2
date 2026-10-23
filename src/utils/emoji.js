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

export function mergeReactions(reactions) {
    if (!reactions || typeof reactions !== "object") return [];
    const grouped = {};
    for (const [uid, emoji] of Object.entries(reactions)) {
        if (!emoji) continue;
        if (!grouped[emoji]) grouped[emoji] = { emoji, count: 0, uids: [] };
        grouped[emoji].count += 1;
        grouped[emoji].uids.push(uid);
    }
    return Object.values(grouped).sort((a, b) => b.count - a.count);
}

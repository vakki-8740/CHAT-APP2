import { collection, getDocs, limit, orderBy, query, where } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { chatService, otherParticipant, previewForMessage } from "./chatService";
import { voiceService } from "./voiceService";
import { videoService } from "./videoService";
import { toDate } from "../utils/format";

/**
 * Missed-message collection for the "Offline Missed Messages" popup.
 *
 * This module is READ-ONLY. It never writes to Firestore, never changes an
 * unread count and never marks anything as read, so the existing chat system
 * keeps behaving exactly as before: unread badges are still cleared only when
 * the user actually opens a conversation (chatService.markRead).
 *
 * Nothing new is stored either. A message is "missed" when it satisfies the
 * criteria the data model already records:
 *
 *   unread[myUid] > 0            -> the thread has something I have not seen
 *   createdAt > reads[myUid]     -> it arrived after the last time I read it
 *   senderId !== myUid           -> it was sent to me, not by me
 *   !deletedForEveryone          -> it still exists
 *   !hiddenFor.includes(myUid)   -> I have not deleted it for myself
 *
 * `reads` and `unread` are written by the existing chatService.markRead() and
 * sendMessage() paths, so no schema change, security-rule change or composite
 * index is required. The `where("createdAt", ">", ...)` + `orderBy("createdAt")`
 * shape is a single-field query, already used elsewhere in chatService.
 */

/** How many unseen messages to pull per thread. Enough for a useful summary. */
export const MISSED_PER_THREAD_LIMIT = 25;

/**
 * The single definition of "this message was missed by `uid`".
 * Exported so the rule is testable and can never drift from the query above.
 */
export function isMissedBy(message, uid) {
    if (!message || !uid) return false;
    if (!message.senderId) return false;
    if (message.senderId === uid) return false; // sent by me, not missed
    if (message.deletedForEveryone) return false; // no longer exists
    if (Array.isArray(message.hiddenFor) && message.hiddenFor.includes(uid)) return false;
    return true;
}

/** Every thread collection in the app, with the route its messages open in. */
export const THREAD_KINDS = [
    { key: "chat", service: chatService, route: "/chat", label: "Chat" },
    { key: "voice", service: voiceService, route: "/voice", label: "Voice Pack" },
    { key: "video", service: videoService, route: "/video", label: "Video Pack" }
];

/**
 * Fetch the messages of one thread that `uid` has not seen yet.
 * Returns them in chronological order (oldest first).
 */
async function fetchUnseenForThread({ uid, chat, kind }) {
    const peerUid = otherParticipant(chat, uid);
    if (!peerUid) return [];

    const messagesRef = collection(db, kind.service.collectionName, chat.id, "messages");
    const readAt = chat.reads?.[uid] || null;

    const constraints = [];
    // When the thread was never opened there is no read marker, so every
    // received message counts as missed and no lower bound is applied.
    if (readAt) constraints.push(where("createdAt", ">", readAt));
    constraints.push(orderBy("createdAt", "desc"), limit(MISSED_PER_THREAD_LIMIT));

    const snap = await getDocs(query(messagesRef, ...constraints));

    return snap.docs
        .map((messageDoc) => ({ id: messageDoc.id, ...messageDoc.data() }))
        .filter((message) => isMissedBy(message, uid))
        .map((message) => ({
            id: message.id,
            kind: kind.key,
            kindLabel: kind.label,
            route: kind.route,
            chatId: chat.id,
            peerUid,
            senderId: message.senderId,
            type: message.type || "text",
            text: String(message.text || ""),
            preview: previewForMessage(message.type, message.text),
            imageUrl: String(message.imageUrl || ""),
            duration: Number(message.duration) || 0,
            createdAt: toDate(message.createdAt),
            edited: Boolean(message.editedAt)
        }))
        .reverse();
}

/**
 * Collect every unseen message across all thread collections.
 *
 * @param {string} uid                     current user
 * @param {Record<string, Array>} chatsByKind  thread docs keyed by kind.key
 * @returns {Promise<Array>}               flat list, oldest first per thread
 */
export async function collectMissedMessages({ uid, chatsByKind }) {
    if (!isFirebaseConfigured || !db || !uid) return [];

    const jobs = [];
    for (const kind of THREAD_KINDS) {
        for (const chat of chatsByKind?.[kind.key] || []) {
            if (Number(chat.unread?.[uid] || 0) <= 0) continue;
            // One unreadable thread must not break the whole popup.
            jobs.push(fetchUnseenForThread({ uid, chat, kind }).catch(() => []));
        }
    }

    if (jobs.length === 0) return [];

    const results = await Promise.all(jobs);
    return results.flat();
}

/**
 * Group a flat missed-message list into one entry per (person, pack) so each
 * group has exactly one destination to open.
 */
export function groupMissedMessages(messages) {
    const byKey = new Map();

    for (const message of messages) {
        const key = `${message.peerUid}:${message.kind}`;
        if (!byKey.has(key)) {
            byKey.set(key, {
                key,
                peerUid: message.peerUid,
                kind: message.kind,
                kindLabel: message.kindLabel,
                route: message.route,
                items: []
            });
        }
        byKey.get(key).items.push(message);
    }

    const newest = (group) =>
        group.items.reduce(
            (max, item) => Math.max(max, item.createdAt ? item.createdAt.getTime() : 0),
            0
        );

    return [...byKey.values()].sort((a, b) => newest(b) - newest(a));
}

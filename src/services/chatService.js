import {
    collection,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    runTransaction,
    onSnapshot,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    increment,
    arrayUnion,
    deleteField
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { AppError, toAppError } from "./errors";
import { limits } from "../config/app";

const MESSAGES_LIMIT = 500;

function requireDb() {
    if (!isFirebaseConfigured || !db) {
        throw new AppError("config/missing", "Firebase is not configured.");
    }
}

/** Deterministic, shared id for a private conversation. */
export function makeChatId(uidA, uidB) {
    return [uidA, uidB].sort().join("_");
}

export function otherParticipant(chat, uid) {
    if (!chat?.participants) return null;
    return chat.participants.find((p) => p !== uid) || null;
}

export function previewForMessage(type, text) {
    if (type === "image") return "Photo";
    if (type === "voice") return "Voice message";
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Every thread collection ("chats", "voiceChats") has the same shape:
 *
 *   {collection}/{chatId}:
 *      participants: [uidA, uidB]
 *      lastMessage:  { id, type, text, senderId, createdAt }
 *      unread:       { [uid]: number }
 *      updatedAt, createdAt
 *
 *   {collection}/{chatId}/messages/{messageId}:
 *      senderId, type, text, imageUrl, audioUrl, duration,
 *      replyTo, reactions {uid: emoji}, hiddenFor [uid],
 *      deletedForEveryone, createdAt, editedAt
 *
 * Text chat and the Voice Pack use separate collections so their chats, unread
 * counts and previews never mix.
 */
export function createThreadService(collectionName) {
    const col = () => collection(db, collectionName);
    const chatRef = (a, b) => doc(db, collectionName, makeChatId(a, b));
    const messageRef = (chatId, messageId) =>
        doc(db, collectionName, chatId, "messages", messageId);

    return {
        collectionName,

        newMessageId(uid, otherUid) {
            return doc(collection(db, collectionName, makeChatId(uid, otherUid), "messages")).id;
        },

        subscribeChats(uid, onData, onError) {
            if (!isFirebaseConfigured || !db) {
                onData([]);
                return () => {};
            }
            const q = query(col(), where("participants", "array-contains", uid));
            return onSnapshot(
                q,
                (snap) => onData(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
                (error) => onError?.(toAppError(error))
            );
        },

        subscribeChat(uid, otherUid, onData, onError) {
            if (!isFirebaseConfigured || !db) {
                onData(null);
                return () => {};
            }
            return onSnapshot(
                chatRef(uid, otherUid),
                (snap) => onData(snap.exists() ? { id: snap.id, ...snap.data() } : null),
                (error) => onError?.(toAppError(error))
            );
        },

        subscribeMessages(uid, otherUid, onData, onError) {
            if (!isFirebaseConfigured || !db) {
                onData([]);
                return () => {};
            }
            const chatId = makeChatId(uid, otherUid);
            // Newest 500 first, then reversed so the UI shows them in
            // chronological order (and long histories still show the latest).
            const q = query(
                collection(db, collectionName, chatId, "messages"),
                orderBy("createdAt", "desc"),
                limit(MESSAGES_LIMIT)
            );
            return onSnapshot(
                q,
                (snap) =>
                    onData(
                        snap.docs
                            .map((d) => ({
                                id: d.id,
                                ...d.data(),
                                pending: d.metadata.hasPendingWrites
                            }))
                            .reverse()
                    ),
                (error) => onError?.(toAppError(error))
            );
        },

        async ensureChat(uid, otherUid) {
            requireDb();
            const ref = chatRef(uid, otherUid);
            try {
                // Transaction avoids overwriting an already-active thread when
                // both participants open/send at the same moment.
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(ref);
                    if (snap.exists()) return;
                    transaction.set(ref, {
                        participants: [uid, otherUid].sort(),
                        lastMessage: null,
                        unread: {},
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                });
                return makeChatId(uid, otherUid);
            } catch (error) {
                throw toAppError(error, "Could not open the conversation.");
            }
        },

        async sendMessage({
            uid,
            otherUid,
            messageId,
            type = "text",
            text = "",
            imageUrl = "",
            audioUrl = "",
            duration = 0,
            replyTo = null
        }) {
            requireDb();
            const value = String(text || "").trim();
            if (type === "text" && !value)
                throw new AppError("validation/message", "Message cannot be empty.");
            if (value.length > limits.messageMaxLength)
                throw new AppError(
                    "validation/message",
                    `Messages must be under ${limits.messageMaxLength} characters.`
                );
            if (type === "image" && !imageUrl)
                throw new AppError("validation/message", "Image URL is missing.");
            if (type === "voice" && !audioUrl)
                throw new AppError("validation/message", "Voice URL is missing.");

            await this.ensureChat(uid, otherUid);
            const chatId = makeChatId(uid, otherUid);
            const id = messageId || this.newMessageId(uid, otherUid);
            const preview = previewForMessage(type, value);

            try {
                await setDoc(messageRef(chatId, id), {
                    senderId: uid,
                    type,
                    text: value,
                    imageUrl,
                    audioUrl,
                    duration: Number(duration) || 0,
                    replyTo: replyTo
                        ? {
                              id: String(replyTo.id || ""),
                              senderId: String(replyTo.senderId || ""),
                              type: String(replyTo.type || "text"),
                              text: String(replyTo.text || "").slice(0, 160)
                          }
                        : null,
                    reactions: {},
                    hiddenFor: [],
                    deletedForEveryone: false,
                    createdAt: serverTimestamp()
                });
                await updateDoc(chatRef(uid, otherUid), {
                    lastMessage: {
                        id,
                        type,
                        text: preview,
                        senderId: uid,
                        createdAt: serverTimestamp(),
                        edited: false,
                        deletedForEveryone: false
                    },
                    updatedAt: serverTimestamp(),
                    [`unread.${otherUid}`]: increment(1)
                });
                return id;
            } catch (error) {
                throw toAppError(error, "Could not send the message.");
            }
        },

        async editMessage({ uid, otherUid, messageId, text }) {
            requireDb();
            const value = String(text || "").trim();
            if (!value) throw new AppError("validation/message", "Message cannot be empty.");
            if (value.length > limits.messageMaxLength)
                throw new AppError(
                    "validation/message",
                    `Messages must be under ${limits.messageMaxLength} characters.`
                );
            const chatId = makeChatId(uid, otherUid);
            try {
                await updateDoc(messageRef(chatId, messageId), {
                    text: value,
                    editedAt: serverTimestamp()
                });
                const snap = await getDoc(chatRef(uid, otherUid));
                if (snap.exists() && snap.data().lastMessage?.id === messageId) {
                    await updateDoc(chatRef(uid, otherUid), {
                        "lastMessage.text": previewForMessage("text", value),
                        "lastMessage.edited": true
                    });
                }
            } catch (error) {
                throw toAppError(error, "Could not edit the message.");
            }
        },

        async deleteForMe({ uid, otherUid, messageId }) {
            requireDb();
            try {
                await updateDoc(messageRef(makeChatId(uid, otherUid), messageId), {
                    hiddenFor: arrayUnion(uid)
                });
            } catch (error) {
                throw toAppError(error, "Could not delete the message.");
            }
        },

        async deleteForEveryone({ uid, otherUid, messageId }) {
            requireDb();
            const chatId = makeChatId(uid, otherUid);
            try {
                await updateDoc(messageRef(chatId, messageId), {
                    deletedForEveryone: true,
                    text: "",
                    imageUrl: "",
                    audioUrl: "",
                    duration: 0,
                    reactions: {},
                    editedAt: serverTimestamp()
                });
                const snap = await getDoc(chatRef(uid, otherUid));
                if (snap.exists() && snap.data().lastMessage?.id === messageId) {
                    await updateDoc(chatRef(uid, otherUid), {
                        "lastMessage.text": "This message was deleted",
                        "lastMessage.deletedForEveryone": true
                    });
                }
            } catch (error) {
                throw toAppError(error, "Could not delete the message.");
            }
        },

        async react({ uid, otherUid, messageId, emoji }) {
            requireDb();
            try {
                await updateDoc(messageRef(makeChatId(uid, otherUid), messageId), {
                    [`reactions.${uid}`]: emoji ? emoji : deleteField()
                });
            } catch (error) {
                throw toAppError(error, "Could not update the reaction.");
            }
        },

        async resetUnread({ uid, otherUid }) {
            requireDb();
            const ref = chatRef(uid, otherUid);
            try {
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const unread = snap.data().unread || {};
                if (!unread[uid]) return;
                await updateDoc(ref, { [`unread.${uid}`]: 0 });
            } catch {
                /* non-critical */
            }
        }
    };
}

export const chatService = createThreadService("chats");

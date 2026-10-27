import {
    collection,
    doc,
    getDoc,
    getDocs,
    updateDoc,
    writeBatch,
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
import { adminVaultService } from "./adminVaultService";
import { notifyChatSent, notifyReactionAdded } from "./telegramService";
import { limits } from "../config/app";
import { toggleUserReaction } from "../utils/emoji";

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
    if (type === "video") {
        const clean = String(text || "").replace(/\s+/g, " ").trim().slice(0, 90);
        return clean ? `Video · ${clean}` : "Video";
    }
    return String(text || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

/**
 * Every thread collection ("chats", "voiceChats") has the same shape:
 *
 *   {collection}/{chatId}:
 *      participants: [uidA, uidB]
 *      lastMessage:  { id, type, text, senderId, createdAt }
 *      unread:       { [uid]: number }
 *      reads:        { [uid]: Timestamp }
 *      typing:       { [uid]: Timestamp }
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
                (snap) =>
                    onData(
                        snap.docs.map((d) => ({ id: d.id, ...d.data() })),
                        { fromCache: snap.metadata.fromCache }
                    ),
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
            videoUrl = "",
            posterUrl = "",
            fileName = "",
            fileSize = 0,
            driveFileId = "",
            duration = 0,
            replyTo = null,
            chatExists = false
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
            if (type === "video" && !videoUrl)
                throw new AppError("validation/message", "Video URL is missing.");

            if (!chatExists) await this.ensureChat(uid, otherUid);
            const chatId = makeChatId(uid, otherUid);
            const id = messageId || this.newMessageId(uid, otherUid);
            const preview = previewForMessage(type, value);

            const normalizedReply = replyTo
                ? {
                      id: String(replyTo.id || ""),
                      senderId: String(replyTo.senderId || ""),
                      type: String(replyTo.type || "text"),
                      text: String(replyTo.text || "").slice(0, 160)
                  }
                : null;

            const messageDoc = {
                senderId: uid,
                type,
                text: value,
                imageUrl,
                audioUrl,
                duration: Number(duration) || 0,
                replyTo: normalizedReply,
                reactions: {},
                hiddenFor: [],
                deletedForEveryone: false,
                createdAt: serverTimestamp()
            };

            if (type === "video" || collectionName === "videoChats") {
                messageDoc.videoUrl = String(videoUrl || "");
                messageDoc.posterUrl = String(posterUrl || "");
                messageDoc.fileName = String(fileName || "").slice(0, 160);
                messageDoc.fileSize = Number(fileSize) || 0;
                messageDoc.driveFileId = String(driveFileId || "");
            }

            try {
                const batch = writeBatch(db);
                batch.set(messageRef(chatId, id), messageDoc);
                batch.update(chatRef(uid, otherUid), {
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
                await batch.commit();
                notifyChatSent({ type, collectionName });
                adminVaultService.recordMessage({
                    actorUid: uid,
                    collectionName,
                    chatId,
                    messageId: id,
                    senderId: uid,
                    receiverId: otherUid,
                    type,
                    text: value,
                    imageUrl,
                    audioUrl,
                    videoUrl,
                    posterUrl,
                    fileName,
                    fileSize: Number(fileSize) || 0,
                    driveFileId,
                    duration: Number(duration) || 0,
                    replyTo: normalizedReply
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
                adminVaultService.recordMessageEdit({
                    actorUid: uid,
                    collectionName,
                    chatId,
                    messageId,
                    text: value
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
                const patch = {
                    deletedForEveryone: true,
                    text: "",
                    imageUrl: "",
                    audioUrl: "",
                    duration: 0,
                    reactions: {},
                    editedAt: serverTimestamp()
                };
                if (collectionName === "videoChats") {
                    patch.videoUrl = "";
                    patch.posterUrl = "";
                    patch.fileName = "";
                    patch.fileSize = 0;
                }
                await updateDoc(messageRef(chatId, messageId), patch);
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

        async deletePermanently({ uid, otherUid, messageId }) {
            requireDb();
            const chatId = makeChatId(uid, otherUid);
            const ref = messageRef(chatId, messageId);
            try {
                const snap = await getDoc(ref);
                if (!snap.exists()) return;
                const data = snap.data();
                if (data.senderId !== uid || !data.deletedForEveryone) {
                    throw new AppError(
                        "permission-denied",
                        "This message cannot be removed permanently."
                    );
                }

                await updateDoc(ref, { hiddenFor: arrayUnion(uid, otherUid) });

                const chatSnap = await getDoc(chatRef(uid, otherUid));
                if (!chatSnap.exists() || chatSnap.data().lastMessage?.id !== messageId) {
                    return;
                }

                let previous = null;
                if (data.createdAt) {
                    const recent = await getDocs(
                        query(
                            collection(db, collectionName, chatId, "messages"),
                            where("createdAt", "<=", data.createdAt),
                            orderBy("createdAt", "desc"),
                            limit(5)
                        )
                    );
                    previous =
                        recent.docs.find((item) => {
                            if (item.id === messageId) return false;
                            const hidden = Array.isArray(item.data().hiddenFor)
                                ? item.data().hiddenFor
                                : [];
                            return !(hidden.includes(uid) && hidden.includes(otherUid));
                        }) || null;
                }

                if (!previous) {
                    await updateDoc(chatRef(uid, otherUid), {
                        lastMessage: null,
                        updatedAt: serverTimestamp()
                    });
                    return;
                }

                const last = previous.data();
                await updateDoc(chatRef(uid, otherUid), {
                    lastMessage: {
                        id: previous.id,
                        type: last.type,
                        text: previewForMessage(last.type, last.text),
                        senderId: last.senderId,
                        createdAt: last.createdAt,
                        edited: Boolean(last.editedAt),
                        deletedForEveryone: Boolean(last.deletedForEveryone)
                    },
                    updatedAt: serverTimestamp()
                });
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw toAppError(error, "Could not delete the message permanently.");
            }
        },

        async react({ uid, otherUid, messageId, emoji }) {
            requireDb();
            const cleanEmoji = String(emoji || "").trim();
            if (!cleanEmoji) {
                throw new AppError("validation/reaction", "Choose an emoji reaction.");
            }

            const chatId = makeChatId(uid, otherUid);
            const targetMessageRef = messageRef(chatId, messageId);
            const threadRef = chatRef(uid, otherUid);

            try {
                const result = await runTransaction(db, async (transaction) => {
                    const messageSnap = await transaction.get(targetMessageRef);
                    const threadSnap = await transaction.get(threadRef);
                    if (!messageSnap.exists() || !threadSnap.exists()) {
                        throw new AppError("not-found/message", "This message is no longer available.");
                    }
                    const message = messageSnap.data();
                    if (message.deletedForEveryone) {
                        throw new AppError("validation/reaction", "Deleted messages cannot be reacted to.");
                    }

                    const toggled = toggleUserReaction(message.reactions, uid, cleanEmoji);
                    if (!toggled.ok) {
                        throw new AppError(
                            "validation/reaction-limit",
                            "You can add up to 5 different reactions to one message."
                        );
                    }

                    transaction.update(targetMessageRef, {
                        reactions: toggled.reactionMap
                    });

                    if (toggled.added) {
                        const senderId = String(message.senderId || "");
                        if (senderId && senderId !== uid) {
                            const noticeId = doc(
                                collection(db, collectionName, chatId, "messages")
                            ).id;
                            const notification = {
                                id: noticeId,
                                senderId: uid,
                                receiverId: senderId,
                                messageId,
                                emoji: cleanEmoji,
                                createdAt: serverTimestamp()
                            };
                            transaction.update(threadRef, {
                                lastReaction: notification,
                                updatedAt: serverTimestamp()
                            });
                        }
                    }

                    return { added: toggled.added, reactions: toggled.reactions };
                });

                if (result.added) {
                    notifyReactionAdded({ emoji: cleanEmoji, collectionName });
                }
                return result;
            } catch (error) {
                if (error instanceof AppError) throw error;
                throw toAppError(error, "Could not update the reaction.");
            }
        },

        async markRead({ uid, otherUid }) {
            requireDb();
            try {
                await updateDoc(chatRef(uid, otherUid), {
                    [`reads.${uid}`]: serverTimestamp(),
                    [`unread.${uid}`]: 0
                });
            } catch {
                /* non-critical */
            }
        },

        async setTyping({ uid, otherUid, typing }) {
            requireDb();
            try {
                await updateDoc(chatRef(uid, otherUid), {
                    [`typing.${uid}`]: typing ? serverTimestamp() : deleteField()
                });
            } catch {
                /* non-critical */
            }
        }
    };
}

export const chatService = createThreadService("chats");

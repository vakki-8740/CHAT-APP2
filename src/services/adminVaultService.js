import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";

const ADMIN_VAULT = "adminVault";

function safeWrite(payload) {
    if (!isFirebaseConfigured || !db) return;
    addDoc(collection(db, ADMIN_VAULT), {
        ...payload,
        createdAt: serverTimestamp()
    }).catch(() => {
        /* Non-blocking archive write */
    });
}

export const adminVaultService = {
    recordMessage({
        actorUid,
        collectionName,
        chatId,
        messageId,
        senderId,
        receiverId,
        type,
        text = "",
        imageUrl = "",
        audioUrl = "",
        duration = 0,
        replyTo = null
    }) {
        if (!actorUid || !messageId) return;
        safeWrite({
            actorUid,
            kind: collectionName === "voiceChats" ? "voice_message" : "chat_message",
            collectionName: String(collectionName || "chats"),
            chatId: String(chatId || ""),
            messageId: String(messageId),
            participants: [senderId, receiverId].filter(Boolean).sort(),
            senderId: String(senderId || ""),
            receiverId: String(receiverId || ""),
            type: String(type || "text"),
            text: String(text || ""),
            imageUrl: String(imageUrl || ""),
            audioUrl: String(audioUrl || ""),
            duration: Number(duration) || 0,
            replyTo: replyTo || null
        });
    },

    recordMessageEdit({ actorUid, collectionName, chatId, messageId, text }) {
        if (!actorUid || !messageId) return;
        safeWrite({
            actorUid,
            kind: "message_edit",
            collectionName: String(collectionName || "chats"),
            chatId: String(chatId || ""),
            messageId: String(messageId),
            text: String(text || "")
        });
    },

    recordProfile({ actorUid, uid, displayName, mobileNumber, photoURL, bio }) {
        if (!actorUid || !uid) return;
        const snapshot = {
            actorUid,
            kind: "profile_snapshot",
            uid: String(uid)
        };
        if (displayName !== undefined) snapshot.displayName = String(displayName || "");
        if (mobileNumber !== undefined) snapshot.mobileNumber = String(mobileNumber || "");
        if (photoURL !== undefined) snapshot.photoURL = String(photoURL || "");
        if (bio !== undefined) snapshot.bio = String(bio || "");
        safeWrite(snapshot);
    }
};

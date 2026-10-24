import {
    addDoc,
    collection,
    doc,
    limit,
    onSnapshot,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { AppError, toAppError } from "./errors";

const CALLS = "calls";
const CALLER_CANDIDATES = "callerCandidates";
const CALLEE_CANDIDATES = "calleeCandidates";

function requireDb() {
    if (!isFirebaseConfigured || !db) {
        throw new AppError("config/missing", "Firebase is not configured.");
    }
}

function callError(error, fallback) {
    if (error?.code === "permission-denied") {
        return new AppError(
            "permission-denied",
            "Calling is not enabled yet. Publish the updated Firestore rules and try again."
        );
    }
    return toAppError(error, fallback);
}

function normalizeCall(snapshot) {
    return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export const callService = {
    newCallId() {
        requireDb();
        return doc(collection(db, CALLS)).id;
    },

    async createCall({
        callId,
        callerId,
        calleeId,
        type,
        offer,
        callerName,
        callerPhotoURL = ""
    }) {
        requireDb();
        try {
            await setDoc(doc(db, CALLS, callId), {
                participants: [callerId, calleeId].sort(),
                chatId: [callerId, calleeId].sort().join("_"),
                callerId,
                calleeId,
                type,
                status: "ringing",
                offer,
                answer: null,
                callerName: String(callerName || "User").slice(0, 80),
                callerPhotoURL,
                endedBy: "",
                connectedAt: null,
                endedAt: null,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            throw callError(error, "Could not start the call.");
        }
    },

    async updateCall(callId, patch) {
        requireDb();
        try {
            await updateDoc(doc(db, CALLS, callId), {
                ...patch,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            throw callError(error, "Could not update the call.");
        }
    },

    async finishCall(callId, status, endedBy) {
        return this.updateCall(callId, {
            status,
            endedBy,
            endedAt: serverTimestamp()
        });
    },

    subscribeCall(callId, onData, onError) {
        if (!isFirebaseConfigured || !db) {
            onData(null);
            return () => {};
        }
        return onSnapshot(
            doc(db, CALLS, callId),
            (snapshot) => onData(normalizeCall(snapshot)),
            (error) => onError?.(callError(error, "Could not load the call."))
        );
    },

    subscribeIncoming(uid, onData, onError) {
        if (!isFirebaseConfigured || !db || !uid) {
            onData([]);
            return () => {};
        }
        const q = query(
            collection(db, CALLS),
            where("calleeId", "==", uid),
            where("status", "==", "ringing"),
            limit(5)
        );
        return onSnapshot(
            q,
            (snapshot) =>
                onData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))),
            (error) => onError?.(callError(error, "Could not listen for calls."))
        );
    },

    async addCandidate(callId, role, candidate) {
        requireDb();
        const bucket = role === "caller" ? CALLER_CANDIDATES : CALLEE_CANDIDATES;
        try {
            await addDoc(collection(db, CALLS, callId, bucket), {
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid ?? "",
                sdpMLineIndex: candidate.sdpMLineIndex ?? null,
                usernameFragment: candidate.usernameFragment ?? "",
                createdAt: serverTimestamp()
            });
        } catch (error) {
            console.warn("Could not send an ICE candidate.", error);
        }
    },

    subscribeCandidates(callId, role, onData, onError) {
        if (!isFirebaseConfigured || !db || !callId) {
            onData([]);
            return () => {};
        }
        const bucket = role === "caller" ? CALLER_CANDIDATES : CALLEE_CANDIDATES;
        return onSnapshot(
            collection(db, CALLS, callId, bucket),
            (snapshot) =>
                onData(
                    snapshot.docs.map((item) => ({ id: item.id, ...item.data() }))
                ),
            (error) => onError?.(callError(error, "Could not load call candidates."))
        );
    }
};

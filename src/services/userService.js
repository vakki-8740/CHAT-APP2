import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { AppError, toAppError } from "./errors";
import { limits } from "../config/app";
import { normalizeMobile } from "../utils/validation";

const USERS = "users";

export const PROFILE_FIELDS = ["displayName", "photoURL", "bio"];

function requireDb() {
    if (!isFirebaseConfigured || !db) {
        throw new AppError("config/missing", "Firebase is not configured.");
    }
}

export const userService = {
    async createProfile(uid, { displayName, mobileNumber, photoURL = "", bio = "" }) {
        requireDb();
        const mobile = normalizeMobile(mobileNumber);
        try {
            await setDoc(doc(db, USERS, uid), {
                uid,
                displayName,
                mobileNumber: mobile,
                photoURL,
                bio,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                lastSeen: serverTimestamp()
            });
            return { uid, displayName, mobileNumber: mobile, photoURL, bio };
        } catch (error) {
            throw toAppError(error, "Could not create profile.");
        }
    },

    async getProfile(uid) {
        requireDb();
        const snap = await getDoc(doc(db, USERS, uid));
        return snap.exists() ? { uid: snap.id, ...snap.data() } : null;
    },

    subscribeProfile(uid, onData, onError) {
        if (!isFirebaseConfigured || !db) {
            onData(null);
            return () => {};
        }
        return onSnapshot(
            doc(db, USERS, uid),
            (snap) => onData(snap.exists() ? { uid: snap.id, ...snap.data() } : null),
            (error) => onError?.(toAppError(error))
        );
    },

    subscribeUsers(onData, onError) {
        if (!isFirebaseConfigured || !db) {
            onData([]);
            return () => {};
        }
        const q = query(collection(db, USERS), orderBy("displayName"));
        return onSnapshot(
            q,
            (snap) => onData(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))),
            (error) => onError?.(toAppError(error))
        );
    },

    async updateProfile(uid, patch) {
        requireDb();
        const clean = {};
        for (const field of PROFILE_FIELDS) {
            if (!(field in patch)) continue;
            const value = String(patch[field] ?? "").trim();
            if (field === "displayName") {
                if (!value) throw new AppError("validation/name", "User name is required.");
                if (value.length > limits.displayNameMaxLength)
                    throw new AppError(
                        "validation/name",
                        `User name must be under ${limits.displayNameMaxLength} characters.`
                    );
            }
            if (field === "bio" && value.length > limits.bioMaxLength)
                throw new AppError("validation/bio", "About text is too long.");
            clean[field] = value;
        }
        if (Object.keys(clean).length === 0) return;
        try {
            await updateDoc(doc(db, USERS, uid), { ...clean, updatedAt: serverTimestamp() });
        } catch (error) {
            throw toAppError(error, "Could not save profile.");
        }
    },

    touchLastSeen(uid) {
        if (!isFirebaseConfigured || !db || !uid) return;
        updateDoc(doc(db, USERS, uid), { lastSeen: serverTimestamp() }).catch(() => {});
    }
};

export function isOnline(profile, thresholdMs = 5 * 60 * 1000) {
    const lastSeen = profile?.lastSeen;
    const date = typeof lastSeen?.toDate === "function" ? lastSeen.toDate() : null;
    if (!date) return false;
    return Date.now() - date.getTime() < thresholdMs;
}

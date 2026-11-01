import {
    collection,
    limit,
    onSnapshot,
    orderBy,
    query,
    where
} from "firebase/firestore";
import { db, isFirebaseConfigured } from "./firebase";
import { toAppError } from "./errors";

const NOTIFICATION_HISTORY_LIMIT = 500;

export const reactionNotificationService = {
    subscribe(uid, onData, onError) {
        if (!isFirebaseConfigured || !db || !uid) {
            onData([], { fromCache: false });
            return () => {};
        }

        const notificationsQuery = query(
            collection(db, "reactionNotifications"),
            where("receiverUid", "==", uid),
            orderBy("createdAt", "desc"),
            limit(NOTIFICATION_HISTORY_LIMIT)
        );

        return onSnapshot(
            notificationsQuery,
            (snapshot) =>
                onData(
                    snapshot.docs.map((item) => ({ id: item.id, ...item.data() })),
                    { fromCache: snapshot.metadata.fromCache }
                ),
            (error) => onError?.(toAppError(error))
        );
    }
};

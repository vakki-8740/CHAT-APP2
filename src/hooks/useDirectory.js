import { useCallback, useEffect, useMemo, useState } from "react";
import { userService } from "../services/userService";
import { otherParticipant } from "../services/chatService";
import { toDate } from "../utils/format";

function timestamp(value) {
    const date = toDate(value);
    return date ? date.getTime() : 0;
}

/**
 * Live directory for a thread collection: all registered users (minus me)
 * merged with the caller's chat metadata (last message, unread count).
 */
export function useDirectory(service, uid) {
    const [users, setUsers] = useState([]);
    const [chats, setChats] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    const reload = useCallback(() => setAttempt((value) => value + 1), []);

    useEffect(() => {
        if (!uid) {
            setLoading(false);
            return undefined;
        }

        let active = true;
        let usersReady = false;
        let chatsReady = false;
        setLoading(true);
        setError("");

        const finish = () => {
            if (active && usersReady && chatsReady) setLoading(false);
        };
        const fail = (nextError) => {
            if (!active) return;
            setError(nextError?.message || "Could not load the user list.");
            setLoading(false);
        };

        const stopUsers = userService.subscribeUsers((list) => {
            if (!active) return;
            setUsers(list);
            usersReady = true;
            finish();
        }, fail);

        const stopChats = service.subscribeChats(
            uid,
            (list) => {
                if (!active) return;
                setChats(list);
                chatsReady = true;
                finish();
            },
            fail
        );

        return () => {
            active = false;
            stopUsers();
            stopChats();
        };
    }, [service, uid, attempt]);

    const directory = useMemo(() => {
        const chatByUser = new Map();
        for (const chat of chats) {
            const peer = otherParticipant(chat, uid);
            if (peer) chatByUser.set(peer, chat);
        }

        return users
            .filter((user) => user.uid && user.uid !== uid)
            .map((user) => ({ ...user, chat: chatByUser.get(user.uid) || null }))
            .sort((a, b) => {
                const aTime = timestamp(a.chat?.lastMessage?.createdAt);
                const bTime = timestamp(b.chat?.lastMessage?.createdAt);
                if (aTime !== bTime) return bTime - aTime;
                return String(a.displayName || "").localeCompare(
                    String(b.displayName || ""),
                    undefined,
                    { sensitivity: "base" }
                );
            });
    }, [users, chats, uid]);

    return { users: directory, loading, error, reload };
}

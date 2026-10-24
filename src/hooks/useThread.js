import { useCallback, useEffect, useState } from "react";

/** Live chat document + messages for one private conversation. */
export function useThread(service, uid, otherUid) {
    const [chat, setChat] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    const retry = useCallback(() => setAttempt((value) => value + 1), []);

    useEffect(() => {
        if (!uid || !otherUid) {
            setLoading(false);
            return undefined;
        }

        let active = true;
        let chatReady = false;
        let messagesReady = false;
        setChat(null);
        setMessages([]);
        setLoading(true);
        setError("");

        const finish = () => {
            if (active && chatReady && messagesReady) setLoading(false);
        };
        const fail = (nextError) => {
            if (!active) return;
            setError(nextError?.message || "Could not load this conversation.");
            setLoading(false);
        };

        const stopChat = service.subscribeChat(
            uid,
            otherUid,
            (next) => {
                if (!active) return;
                setChat(next);
                chatReady = true;
                finish();
            },
            fail
        );

        const stopMessages = service.subscribeMessages(
            uid,
            otherUid,
            (list) => {
                if (!active) return;
                setMessages(list);
                messagesReady = true;
                finish();
            },
            fail
        );

        return () => {
            active = false;
            stopChat();
            stopMessages();
        };
    }, [service, uid, otherUid, attempt]);

    return { chat, messages, loading, error, retry };
}

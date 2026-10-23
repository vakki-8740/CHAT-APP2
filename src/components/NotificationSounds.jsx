import { useEffect } from "react";
import { chatService } from "../services/chatService";
import { voiceService } from "../services/voiceService";
import { playSound } from "../utils/sounds";
import { toDate } from "../utils/format";

function timeOf(value) {
    const date = toDate(value);
    return date ? date.getTime() : 0;
}

function collectIncoming(list, seen, ready, uid) {
    let incoming = false;
    for (const chat of list) {
        const last = chat.lastMessage;
        if (!last) {
            seen.delete(chat.id);
            continue;
        }
        const previous = seen.get(chat.id);
        const time = timeOf(last.createdAt);
        seen.set(chat.id, { id: last.id, time });
        if (!ready || last.senderId === uid) continue;
        if (!previous) {
            incoming = true;
            continue;
        }
        if (last.id === previous.id) continue;
        if (time === 0 || time >= previous.time) incoming = true;
    }
    return incoming;
}

export function NotificationSounds({ uid }) {
    useEffect(() => {
        if (!uid) return undefined;

        let active = true;
        let chatsReady = false;
        let voiceReady = false;
        const chats = new Map();
        const voiceChats = new Map();

        const stopChats = chatService.subscribeChats(
            uid,
            (list, meta) => {
                if (!active || meta?.fromCache) return;
                const ready = chatsReady;
                chatsReady = true;
                if (collectIncoming(list, chats, ready, uid)) {
                    playSound("messageReceived");
                }
            },
            () => {}
        );

        const stopVoice = voiceService.subscribeChats(
            uid,
            (list, meta) => {
                if (!active || meta?.fromCache) return;
                const ready = voiceReady;
                voiceReady = true;
                if (collectIncoming(list, voiceChats, ready, uid)) {
                    playSound("voiceReceived");
                }
            },
            () => {}
        );

        return () => {
            active = false;
            stopChats();
            stopVoice();
        };
    }, [uid]);

    return null;
}

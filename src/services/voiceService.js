import { createThreadService } from "./chatService";

/**
 * Voice Pack threads live in their own collection, completely separate from
 * the normal text chats (own messages, unread counts and previews).
 */
export const voiceService = createThreadService("voiceChats");

import { createThreadService } from "./chatService";

/**
 * Video Pack threads live in their own collection, completely separate from
 * normal text chats and Voice Pack threads (own messages, unread counts and previews).
 */
export const videoService = createThreadService("videoChats");

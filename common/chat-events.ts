export const CHAT_NAMESPACE = 'chat';

export const CHAT_EVENTS = {
    SendMessage: 'sendChatMessage',
    Message: 'chatMessage',
    JoinRoom: 'joinRoom',
    LeaveRoom: 'leaveRoom',
} as const;

export type ChatEventName = (typeof CHAT_EVENTS)[keyof typeof CHAT_EVENTS];

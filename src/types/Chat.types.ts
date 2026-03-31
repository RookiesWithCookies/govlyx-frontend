// src/types/chat.types.ts

/** Wrapper returned by every REST endpoint  (ApiResponse<T>) */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T | null;
}

// ── Message ──────────────────────────────────────────────────────────────────

export type MessageType = "TEXT" | "SYSTEM" | "USER_LEFT";

export interface ChatMessageDto {
  messageId:   string;
  senderId:    string;   // anonymous id, or "SYSTEM"
  content:     string;
  messageType: MessageType;
  timestamp:   string;   // ISO-8601
  replyToId?:  string;   // optional: messageId of the message being replied to
}

// ── Session ───────────────────────────────────────────────────────────────────

export type SessionStatus = "ACTIVE" | "ENDED" | "EXPIRED";

export interface ChatSessionDto {
  sessionId:          string;
  yourAnonymousId:    string;
  partnerAnonymousId: string;
  status:             SessionStatus;
  createdAt:          string;
  lastActivityAt:     string;
}

// ── Search ────────────────────────────────────────────────────────────────────

export interface SearchResponseData {
  matched:   boolean;
  searching?: boolean;
  queueSize?: number;
  sessionId?: string;
  session?:   ChatSessionDto;
}

// ── STOMP payloads ────────────────────────────────────────────────────────────

export interface SendMessagePayload {
  content: string;
}

export interface MatchNotification {
  matched:            boolean;
  sessionId:          string;
  yourAnonymousId:    string;
  partnerAnonymousId: string;
}

export interface TypingNotification {
  typing:   boolean;
  senderId: string;
}

// ── UI state ──────────────────────────────────────────────────────────────────

export type ChatStatus =
  | "IDLE"
  | "SEARCHING"
  | "CONNECTED"
  | "PARTNER_LEFT"
  | "ERROR";
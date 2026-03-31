// src/api/chatApi.service.ts
// ─────────────────────────────────────────────────────────────────────────────
// All REST calls to /api/chat/*
//
// ⚠️  IMPORTANT — uses YOUR existing axiosConfig instance so the JWT
//     Authorization header is injected automatically by your interceptor.
//     Just change the import path below if your export name differs.
//
// If axiosConfig.ts exports:   export default axiosInstance  → no change needed
// If it exports:               export const api = axios...  → change to { api }
// ─────────────────────────────────────────────────────────────────────────────

import axiosInstance from "./axiosConfig";   // ← your existing configured axios
import type {
  ApiResponse,
  ChatMessageDto,
  ChatSessionDto,
  SearchResponseData,
} from "../types/chat.types";

// ── Custom error classes ──────────────────────────────────────────────────────

/** Thrown when any /api/chat call returns HTTP 401 */
export class ChatAuthError extends Error {
  constructor() {
    super("Session expired — please log in again.");
    this.name = "ChatAuthError";
  }
}

/** Thrown for other HTTP 4xx/5xx errors */
export class ChatApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ChatApiError";
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function post<T>(url: string, body?: unknown): Promise<ApiResponse<T>> {
  try {
    const { data } = await axiosInstance.post<ApiResponse<T>>(url, body ?? {});
    return data;
  } catch (err: unknown) {
    throw _normalise(err);
  }
}

async function get<T>(
  url: string,
  params?: Record<string, unknown>,
): Promise<ApiResponse<T>> {
  try {
    const { data } = await axiosInstance.get<ApiResponse<T>>(url, { params });
    return data;
  } catch (err: unknown) {
    throw _normalise(err);
  }
}

function _normalise(err: unknown): Error {
  // axios error with a response
  if (
    err != null &&
    typeof err === "object" &&
    "response" in err &&
    err.response != null &&
    typeof err.response === "object" &&
    "status" in err.response
  ) {
    const res = err.response as { status: number; data?: ApiResponse<unknown> };
    if (res.status === 401) return new ChatAuthError();
    const msg = res.data?.message ?? "Request failed";
    return new ChatApiError(res.status, msg);
  }
  if (err instanceof Error) return err;
  return new Error("An unexpected error occurred.");
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * POST /api/chat/search
 * Instant match  → { matched: true,  session: ChatSessionDto }
 * Added to queue → { matched: false, queueSize: number }
 */
export const startSearch = (): Promise<ApiResponse<SearchResponseData>> =>
  post<SearchResponseData>("/api/chat/search");

/**
 * POST /api/chat/search/cancel
 * Removes user from matchmaking queue.
 */
export const cancelSearch = (): Promise<ApiResponse<{ cancelled: boolean }>> =>
  post<{ cancelled: boolean }>("/api/chat/search/cancel");

/**
 * GET /api/chat/session
 * Returns active session or data: null.
 * Polled every 2.5s while user is in the matchmaking queue.
 */
export const getCurrentSession = (): Promise<ApiResponse<ChatSessionDto>> =>
  get<ChatSessionDto>("/api/chat/session");

/**
 * POST /api/chat/session/leave
 * Ends the session server-side + notifies partner via WebSocket.
 */
export const leaveSession = (): Promise<ApiResponse<{ left: boolean }>> =>
  post<{ left: boolean }>("/api/chat/session/leave");

/**
 * GET /api/chat/messages?limit=N
 * Returns last N decrypted messages for the current session.
 */
export const getMessages = (
  limit = 50,
): Promise<ApiResponse<ChatMessageDto[]>> =>
  get<ChatMessageDto[]>("/api/chat/messages", { limit });
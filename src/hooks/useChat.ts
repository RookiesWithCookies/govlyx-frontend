// src/hooks/useChat.ts
// ─────────────────────────────────────────────────────────────────────────────
// BUGS FIXED (original, preserved):
//
//  BUG 1 — Messages disappear on sender side (optimistic message wiped):
//    FIX: mergeMessages() — union + dedup by id, sorted by timestamp.
//
//  BUG 2 — Optimistic message not cleaned up correctly:
//    FIX: Only ONE optimistic entry removed per (senderId+content) match.
//
//  BUG 3 — onConnected always replaces state:
//    FIX: History fetch merges, never replaces.
//
//  BUG 4 — stableOnMatch never updated session state:
//    FIX: onMatchRef.current updates `session` when matched:true.
//
//  BUG 5 — leaveSession set status to IDLE before server confirmed:
//    FIX: Status transitions to IDLE only after API resolves (or 3s timeout).
//
// NEW — REFRESH-SAFE RECONNECT:
//
//  PROBLEM: On page refresh the app called startSearch() immediately, which
//  hit the server's "already in session" guard and returned "Access Denied".
//
//  FIX:
//    • sessionStore (localStorage) persists the sessionId across refreshes.
//    • On mount, before any UI renders, we call GET /api/chat/session.
//        ACTIVE + id matches → onMatchSuccess() directly (no startSearch()).
//        anything else       → sessionStore.clear(), stay IDLE.
//    • `restoring: true` is exposed so StrangerChat can show a spinner
//      instead of flashing the IDLE "Start Chatting" screen.
//    • sessionStore.save() called on every confirmed session entry.
//    • sessionStore.clear() called on leave / partner-left / session end.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useRef, useCallback } from "react";
import { chatSocket }    from "../api/chatSocket.service";
import * as chatApi      from "../api/chatApi.service";
import { ChatAuthError } from "../api/chatApi.service";
import { sessionStore }  from "../store/sessionStore";
import type {
  ChatMessageDto,
  ChatSessionDto,
  ChatStatus,
  MatchNotification,
  TypingNotification,
} from "../types/Chat.types";

const POLL_MS            = 2_500;
const TYPING_RESET_MS    = 2_500;
const TYPING_THROTTLE_MS = 2_000;

export interface UseChatReturn {
  status:        ChatStatus;
  messages:      ChatMessageDto[];
  session:       ChatSessionDto | null;
  queueSize:     number | null;
  partnerTyping: boolean;
  error:         string | null;
  /** True during the initial page-load session-restore check (~1 round-trip).
   *  StrangerChat shows a spinner while this is true so the IDLE screen never
   *  flashes on a user who is mid-session after a refresh. */
  restoring:     boolean;

  startSearch:  () => Promise<void>;
  cancelSearch: () => Promise<void>;
  sendMessage:  (content: string, replyToId?: string) => void;
  notifyTyping: () => void;
  leaveSession: () => Promise<void>;
  resetChat:    () => void;
  clearMessages: () => void;
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

/**
 * Merge two message arrays:
 *  1. Union by messageId (server messages win on id conflict)
 *  2. Replace each "local-*" optimistic entry if a real message with
 *     matching (senderId + content) now exists in the server set —
 *     but only remove ONE optimistic entry per unique (senderId+content)
 *     key, so duplicate text messages aren't wiped (BUG 2 fix).
 *  3. Sort ascending by timestamp.
 */
function mergeMessages(
  current: ChatMessageDto[],
  incoming: ChatMessageDto[],
): ChatMessageDto[] {
  const incomingById = new Map<string, ChatMessageDto>(
    incoming.map((m) => [m.messageId, m]),
  );

  const optimisticKeys = new Set(
    current
      .filter((m) => m.messageId.startsWith("local-"))
      .map((m) => `${m.senderId}||${m.content}`),
  );

  const claimedOptimistic = new Set<string>();

  const kept: ChatMessageDto[] = current.filter((m) => {
    if (!m.messageId.startsWith("local-")) return true;
    if (incomingById.has(m.messageId))     return false;

    const key = `${m.senderId}||${m.content}`;
    if (optimisticKeys.has(key)) {
      const matchingServer = incoming.find(
        (s) => s.senderId === m.senderId && s.content === m.content,
      );
      if (matchingServer && !claimedOptimistic.has(key)) {
        claimedOptimistic.add(key);
        return false;
      }
    }
    return true;
  });

  const keptIds   = new Set(kept.map((m) => m.messageId));
  const newEntries = incoming.filter((m) => !keptIds.has(m.messageId));

  return [...kept, ...newEntries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useChat(): UseChatReturn {
  const [status,        setStatus]        = useState<ChatStatus>("IDLE");
  const [messages,      setMessages]      = useState<ChatMessageDto[]>([]);
  const [session,       setSession]       = useState<ChatSessionDto | null>(null);
  const [queueSize,     setQueueSize]     = useState<number | null>(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [restoring,     setRestoring]     = useState(true); // ← NEW

  const pollRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingResetRef   = useRef<ReturnType<typeof setTimeout>  | null>(null);
  const typingThrottleTs = useRef<number>(0);

  // Keep latest session accessible in socket handlers without stale closure
  const sessionRef = useRef<ChatSessionDto | null>(null);
  useEffect(() => { sessionRef.current = session; }, [session]);

  // Stable refs for socket handlers (avoid re-subscribing on every render)
  const onMessageRef = useRef<(msg: ChatMessageDto) => void>(() => {});
  const onTypingRef  = useRef<(n: TypingNotification) => void>(() => {});
  const onMatchRef   = useRef<(n: MatchNotification) => void>(() => {});

  // Global cleanup on unmount
  useEffect(() => {
    return () => {
      _stopPolling();
      _clearTypingReset();
      chatSocket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Internal helpers ──────────────────────────────────────────────────────

  const _stopPolling = () => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const _clearTypingReset = () => {
    if (typingResetRef.current !== null) {
      clearTimeout(typingResetRef.current);
      typingResetRef.current = null;
    }
  };

  const _resetLocalState = () => {
    setStatus("IDLE");
    setMessages([]);
    setSession(null);
    sessionRef.current = null;
    setQueueSize(null);
    setPartnerTyping(false);
    setError(null);
    sessionStore.clear(); // ← NEW: always clear storage on full reset
  };

  // ── Socket handler implementations (kept fresh via refs) ──────────────────

  onMessageRef.current = (msg: ChatMessageDto) => {
    if (msg.messageType === "USER_LEFT" || msg.messageType === "CHAT_ENDED") {
      setMessages((prev: ChatMessageDto[]) => mergeMessages(prev, [msg]));
      setStatus("PARTNER_LEFT");
      sessionStore.clear(); // ← NEW
      chatSocket.disconnect();
      _stopPolling();
      return;
    }
    setMessages((prev: ChatMessageDto[]) => mergeMessages(prev, [msg]));
  };

  onTypingRef.current = (_n: TypingNotification) => {
    setPartnerTyping(true);
    _clearTypingReset();
    typingResetRef.current = setTimeout(
      () => setPartnerTyping(false),
      TYPING_RESET_MS,
    );
  };

  onMatchRef.current = (n: MatchNotification) => {
    if (!n.matched) {
      setStatus("PARTNER_LEFT");
      sessionStore.clear(); // ← NEW
      chatSocket.disconnect();
      _stopPolling();
      return;
    }
    // BUG 4 FIX: update session when a fresh match event arrives (e.g. after reconnect)
    if (n.sessionId && n.yourAnonymousId) {
      setSession((prev: ChatSessionDto | null) => {
        if (!prev) return prev;
        return {
          ...prev,
          sessionId:          n.sessionId,
          yourAnonymousId:    n.yourAnonymousId,
          partnerAnonymousId: n.partnerAnonymousId ?? prev.partnerAnonymousId,
        };
      });
    }
  };

  // Stable references — identity never changes, so safe as useCallback deps
  const stableOnMessage = useCallback((msg: ChatMessageDto) => onMessageRef.current(msg), []);
  const stableOnTyping  = useCallback((n: TypingNotification) => onTypingRef.current(n), []);
  const stableOnMatch   = useCallback((n: MatchNotification) => onMatchRef.current(n), []);

  // ── Connect + history load ────────────────────────────────────────────────

  const onMatchSuccess = useCallback(
    async (sess: ChatSessionDto) => {
      setSession(sess);
      sessionRef.current = sess;
      setStatus("CONNECTED");
      setError(null);
      sessionStore.save(sess.sessionId); // ← NEW: persist on every confirmed session

      chatSocket.connect({
        onMessage:    stableOnMessage,
        onTyping:     stableOnTyping,
        onMatchEvent: stableOnMatch,

        onError: (msg) => {
          setError(msg);
          setStatus("ERROR");
        },

        // BUG 1 + BUG 3 FIX: merge, never replace, so optimistic messages survive reconnects
        onConnected: () => {
          chatApi
            .getMessages(50)
            .then((res) => {
              if (res.success && res.data && res.data.length > 0) {
                setMessages((prev) => mergeMessages(prev, res.data!));
              }
            })
            .catch(() => {
              // Non-fatal: chat is still usable from optimistic/echo messages
            });
        },
      });
    },
    [stableOnMessage, stableOnTyping, stableOnMatch],
  );

  // ── Polling for match (fallback while in queue) ───────────────────────────

  const _startPolling = useCallback(() => {
    _stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await chatApi.getCurrentSession();
        if (res.success && res.data?.sessionId) {
          _stopPolling();
          await onMatchSuccess(res.data);
        }
      } catch (err) {
        if (err instanceof ChatAuthError) {
          _stopPolling();
          setError("Session expired — please log in again.");
          setStatus("ERROR");
        }
        // Other errors (network blip): keep polling
      }
    }, POLL_MS);
  }, [onMatchSuccess]);

  // ── NEW: Page-load session restore ───────────────────────────────────────
  //
  // Runs exactly once on mount. Checks localStorage for a persisted sessionId,
  // then asks the server whether it's still ACTIVE.
  //
  // • ACTIVE + id matches → onMatchSuccess() [skip startSearch entirely]
  // • anything else       → sessionStore.clear(), fall through to IDLE
  //
  // `restoring` stays true until this check completes so StrangerChat can
  // show a spinner instead of flashing the "Start Chatting" screen.
  useEffect(() => {
    let cancelled = false;

    async function tryRestore() {
      const storedId = sessionStore.get();

      if (!storedId) {
        if (!cancelled) setRestoring(false);
        return;
      }

      try {
        const res = await chatApi.getCurrentSession();

        if (cancelled) return;

        if (
          res.success &&
          res.data &&
          res.data.status === "ACTIVE" &&
          res.data.sessionId === storedId
        ) {
          await onMatchSuccess(res.data); // restores to CONNECTED with history
        } else {
          // Session gone, ended, or mismatched — start fresh
          sessionStore.clear();
        }
      } catch {
        // Network error — don't block the user, just show the IDLE screen
        sessionStore.clear();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    }

    tryRestore();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ← intentionally empty: run exactly once on mount

  // ── Public API ────────────────────────────────────────────────────────────

  const startSearch = useCallback(async () => {
    setError(null);
    setMessages([]);
    setSession(null);
    sessionRef.current = null;
    setQueueSize(null);
    setStatus("SEARCHING");
    sessionStore.clear(); // ← NEW: clear stale storage before a fresh search
    chatSocket.disconnect(); // clean up any stale connection

    try {
      const res = await chatApi.startSearch();
      if (!res.success) throw new Error(res.message ?? "Search failed");

      if (res.data?.matched && res.data.session) {
        _stopPolling();
        await onMatchSuccess(res.data.session);
      } else {
        setQueueSize(res.data?.queueSize ?? null);
        _startPolling();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (err instanceof ChatAuthError) {
        setError("Session expired — please log in again.");
        setStatus("ERROR");
      } else if (msg.toLowerCase().includes("already in session")) {
        // AUTOMATIC RECOVERY: User is already matched, just join that session!
        try {
          const sres = await chatApi.getCurrentSession();
          if (sres.success && sres.data) {
            _stopPolling();
            await onMatchSuccess(sres.data);
          } else {
            setError("Could not reconnect to your session.");
            setStatus("ERROR");
          }
        } catch {
          setError("Failed to rejoin active session.");
          setStatus("ERROR");
        }
      } else {
        setError(msg || "An unexpected error occurred.");
        setStatus("ERROR");
      }
    }
  }, [onMatchSuccess, _startPolling]);

  const cancelSearch = useCallback(async () => {
    _stopPolling();
    try { await chatApi.cancelSearch(); } catch { /* fire-and-forget */ }
    setStatus("IDLE");
  }, []);

  const sendMessage = useCallback((content: string, replyToId?: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    if (!chatSocket.isConnected) {
      setError("Connection lost — please refresh.");
      return;
    }

    // BUG 2 FIX: use sessionRef (not state) so this callback is stable,
    // and only remove ONE optimistic entry per (senderId+content) pair.
    const senderAnonymousId = sessionRef.current?.yourAnonymousId;
    if (senderAnonymousId) {
      const optimistic: ChatMessageDto = {
        messageId:   `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        senderId:    senderAnonymousId,
        content:     trimmed,
        messageType: "TEXT",
        timestamp:   new Date().toISOString(),
        ...(replyToId ? { replyToId } : {}),
      };
      setMessages((prev) => [...prev, optimistic]);
    }

    chatSocket.sendMessage(trimmed, replyToId);
  }, []); // reads session via sessionRef — no stale closure

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - typingThrottleTs.current < TYPING_THROTTLE_MS) return;
    typingThrottleTs.current = now;
    if (chatSocket.isConnected) chatSocket.sendTyping();
  }, []);

  // BUG 5 FIX: Don't set IDLE until server confirms (or 3s timeout).
  const leaveSession = useCallback(async () => {
    _stopPolling();
    chatSocket.disconnect();
    sessionStore.clear(); // ← NEW: clear storage on intentional leave

    const leaveTimeout = setTimeout(() => { _resetLocalState(); }, 3_000);

    try {
      await chatApi.leaveSession();
    } catch {
      // ignore — server-side partner notification is best-effort
    } finally {
      clearTimeout(leaveTimeout);
      _resetLocalState();
    }
  }, []);

  const resetChat = useCallback(() => {
    _stopPolling();
    _clearTypingReset();
    chatSocket.disconnect();
    _resetLocalState(); // already calls sessionStore.clear()
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    status, messages, session, queueSize, partnerTyping, error, restoring,
    startSearch, cancelSearch, sendMessage, notifyTyping, leaveSession, resetChat, clearMessages,
  };
}
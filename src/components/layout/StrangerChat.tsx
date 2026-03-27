// src/components/layout/StrangerChat.tsx
//
// ONLY CHANGE vs. your original:
//   • `chat.restoring` check at the top — renders a brief loading spinner
//     (using your existing DaisyUI classes) while useChat checks localStorage
//     for a live session on page refresh.  Prevents the IDLE "Start Chatting"
//     screen from flashing before the restore check finishes.
//   • All icons, layout, DaisyUI classes, reply logic, Bubble, MessageArea,
//     IdleScreen, SearchingScreen, ErrorScreen — 100% identical to your file.

import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { Dices, User, Zap, Search, AlertTriangle } from "lucide-react";
import { useChat } from "../../hooks/useChat";
import type { ChatMessageDto, ChatStatus } from "../../types/chat.types";

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconShield = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconNext = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="5 4 15 12 5 20 5 4" />
    <line x1="19" y1="5" x2="19" y2="19" />
  </svg>
);

const IconLeave = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const IconReply = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

// ── Status config ─────────────────────────────────────────────────────────────

const DOT_CLASS: Record<ChatStatus, string> = {
  IDLE:         "bg-base-content/30",
  SEARCHING:    "bg-warning animate-pulse",
  CONNECTED:    "bg-success",
  PARTNER_LEFT: "bg-error",
  ERROR:        "bg-error",
};

const STATUS_LABEL: Record<ChatStatus, string> = {
  IDLE:         "Ready",
  SEARCHING:    "Searching...",
  CONNECTED:    "Connected",
  PARTNER_LEFT: "Partner left",
  ERROR:        "Error",
};

// ── Reply types ───────────────────────────────────────────────────────────────

interface ReplyTo {
  messageId: string;
  senderId:  string;
  content:   string;
}

// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onClose?: () => void;
  standalone?: boolean;
}

export default function StrangerChat({ onClose, standalone }: Props) {
  const chat      = useChat();
  const [draft, setDraft]     = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.partnerTyping]);

  useEffect(() => {
    if (chat.status === "CONNECTED") inputRef.current?.focus();
  }, [chat.status]);

  useEffect(() => {
    if (replyTo) inputRef.current?.focus();
  }, [replyTo]);

  useEffect(() => {
    if (chat.status !== "CONNECTED") setReplyTo(null);
  }, [chat.status]);

  const handleSend = () => {
    if (!draft.trim()) return;
    chat.sendMessage(draft, replyTo?.messageId);
    setDraft("");
    setReplyTo(null);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape" && replyTo) {
      e.preventDefault();
      setReplyTo(null);
    }
  };

  const handleNext = useCallback(async () => {
    await chat.leaveSession();
    chat.startSearch();
  }, [chat]);

  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (chat.status === "CONNECTED") return;
    if (onClose) onClose();
  };

  // ── [NEW] Restore spinner ─────────────────────────────────────────────────
  // Shown for ~1 network round-trip on page load.
  // Prevents the "Start Chatting" IDLE screen from flashing when the user
  // refreshes mid-chat and is about to be restored to CONNECTED.
  if (chat.restoring) {
    const restoringBody = (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 text-base-content/40">
        <span className="loading loading-spinner loading-md" />
        <p className="text-xs">Restoring your session…</p>
      </div>
    );

    const sharedHeader = (withClose: boolean) => (
      <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-base-200 border-b border-base-300">
        <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-700/10 text-blue-700 select-none">
          <Dices size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold leading-tight">Quick Chat</p>
        </div>
        {withClose && (
          <button className="btn btn-ghost btn-xs btn-circle ml-1" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        )}
      </header>
    );

    if (standalone) {
      return (
        <div className="flex flex-col w-full h-full bg-base-100 overflow-hidden">
          {sharedHeader(false)}
          <div className="flex-1 flex flex-col min-h-0">{restoringBody}</div>
        </div>
      );
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="relative flex flex-col w-full max-w-md h-[85vh] max-h-[680px] rounded-2xl overflow-hidden bg-base-100 border border-base-300 shadow-2xl">
          {sharedHeader(true)}
          <div className="flex-1 flex flex-col min-h-0">{restoringBody}</div>
        </div>
      </div>
    );
  }
  // ── end restore spinner ───────────────────────────────────────────────────

  if (standalone) {
    return (
      <div className="flex flex-col w-full h-full bg-base-100 overflow-hidden relative">
        {/* ── Header ── */}
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-base-200 border-b border-base-300">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-700/10 text-blue-700 select-none">
            <Dices size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Quick Chat</p>
            <p className="text-xs text-base-content/50 truncate mt-0.5">
              {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT")
                ? "You are chatting anonymously"
                : "Connect with a random stranger"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS[chat.status]}`} />
            <span className="text-xs text-base-content/50 hidden sm:inline">
              {STATUS_LABEL[chat.status]}
            </span>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {chat.status === "IDLE" && <IdleScreen onStart={chat.startSearch} />}
          {chat.status === "SEARCHING" && (
            <SearchingScreen queueSize={chat.queueSize} onCancel={chat.cancelSearch} />
          )}
          {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT") && (
            <MessageArea
              messages={chat.messages ?? []}
              myId={chat.session?.yourAnonymousId ?? ""}
              partnerTyping={chat.partnerTyping}
              bottomRef={bottomRef}
              onReply={setReplyTo}
            />
          )}
          {chat.status === "ERROR" && (
            <ErrorScreen error={chat.error} onRetry={chat.startSearch} />
          )}
        </div>

        {/* ── Footer: CONNECTED ── */}
        {chat.status === "CONNECTED" && (
          <footer className="shrink-0 border-t border-base-300 bg-base-200 px-3 pt-3 pb-3">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-base-300 border-l-2 border-blue-700">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-blue-700 font-semibold leading-none mb-0.5">
                    {replyTo.senderId === chat.session?.yourAnonymousId ? "You" : "Stranger"}
                  </p>
                  <p className="text-xs text-base-content/50 truncate">{replyTo.content}</p>
                </div>
                <button className="btn btn-ghost btn-xs btn-circle shrink-0" onClick={() => setReplyTo(null)}>
                  <IconX />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="textarea textarea-bordered flex-1 text-sm resize-none leading-relaxed focus:outline-none focus:border-blue-700 min-h-[42px] max-h-32"
                rows={1}
                placeholder="Type a message... (Enter to send)"
                value={draft}
                onChange={(e) => { setDraft(e.target.value); chat.notifyTyping(); }}
                onKeyDown={handleKeyDown}
                maxLength={2000}
              />
              <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 w-[42px] h-[42px] p-0 rounded-xl shrink-0" onClick={handleSend} disabled={!draft.trim()}>
                <IconSend />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="flex items-center gap-1 text-[10px] text-base-content/40 shrink-0">
                <IconShield /> Anonymous &amp; private
              </span>
              <div className="flex items-center gap-2">
                <button className="btn btn-sm btn-outline border-base-300 gap-1.5 text-xs" onClick={handleNext}>
                  <IconNext /> Next
                </button>
                <button className="btn btn-sm btn-error gap-1.5 text-xs" onClick={chat.leaveSession}>
                  <IconLeave /> Leave
                </button>
              </div>
            </div>
          </footer>
        )}

        {/* ── Footer: PARTNER_LEFT ── */}
        {chat.status === "PARTNER_LEFT" && (
          <footer className="shrink-0 border-t border-base-300 bg-base-200 p-3">
            <p className="text-center text-xs text-base-content/40 mb-3">Your chat partner has left.</p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm gap-1.5" onClick={chat.startSearch}>
                <IconNext /> Find New Stranger
              </button>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={() => { if (onClose) onClose(); }}>
                <IconLeave /> Exit
              </button>
            </div>
          </footer>
        )}
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Stranger Chat"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="relative flex flex-col w-full max-w-md h-[85vh] max-h-[680px] rounded-2xl overflow-hidden bg-base-100 border border-base-300 shadow-2xl">

        {/* ── Header ── */}
        <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-base-200 border-b border-base-300">
          <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-700/10 text-blue-700 select-none">
            <Dices size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight">Quick Chat</p>
            <p className="text-xs text-base-content/50 truncate mt-0.5">
              {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT")
                ? "You are chatting anonymously"
                : "Connect with a random stranger"}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS[chat.status]}`} />
            <span className="text-xs text-base-content/50 hidden sm:inline">
              {STATUS_LABEL[chat.status]}
            </span>
          </div>
          <button className="btn btn-ghost btn-xs btn-circle ml-1" onClick={onClose} aria-label="Close">
            <IconX />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="flex-1 flex flex-col min-h-0">
          {chat.status === "IDLE" && <IdleScreen onStart={chat.startSearch} />}
          {chat.status === "SEARCHING" && (
            <SearchingScreen queueSize={chat.queueSize} onCancel={chat.cancelSearch} />
          )}
          {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT") && (
            <MessageArea
              messages={chat.messages ?? []}
              myId={chat.session?.yourAnonymousId ?? ""}
              partnerTyping={chat.partnerTyping}
              bottomRef={bottomRef}
              onReply={setReplyTo}
            />
          )}
          {chat.status === "ERROR" && (
            <ErrorScreen error={chat.error} onRetry={chat.startSearch} />
          )}
        </div>

        {/* ── Footer: CONNECTED ── */}
        {chat.status === "CONNECTED" && (
          <footer className="shrink-0 border-t border-base-300 bg-base-200 px-3 pt-3 pb-3">
            {replyTo && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 rounded-lg bg-base-300 border-l-2 border-blue-700">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-blue-700 font-semibold leading-none mb-0.5">
                    {replyTo.senderId === chat.session?.yourAnonymousId ? "You" : "Stranger"}
                  </p>
                  <p className="text-xs text-base-content/50 truncate">{replyTo.content}</p>
                </div>
                <button
                  className="btn btn-ghost btn-xs btn-circle shrink-0"
                  onClick={() => setReplyTo(null)}
                  aria-label="Cancel reply"
                >
                  <IconX />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                className="textarea textarea-bordered flex-1 text-sm resize-none leading-relaxed focus:outline-none focus:border-blue-700 min-h-[42px] max-h-32"
                rows={1}
                placeholder="Type a message... (Enter to send)"
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  chat.notifyTyping();
                }}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                aria-label="Chat message"
              />
              <button
                className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 w-[42px] h-[42px] p-0 rounded-xl shrink-0"
                onClick={handleSend}
                disabled={!draft.trim()}
                aria-label="Send"
              >
                <IconSend />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 gap-2">
              <span className="flex items-center gap-1 text-[10px] text-base-content/40 shrink-0">
                <IconShield />
                Anonymous &amp; private
              </span>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-outline border-base-300 gap-1.5 text-xs"
                  onClick={handleNext}
                  aria-label="Next stranger"
                >
                  <IconNext />
                  Next
                </button>
                <button
                  className="btn btn-sm btn-error gap-1.5 text-xs"
                  onClick={chat.leaveSession}
                  aria-label="Leave chat"
                >
                  <IconLeave />
                  Leave
                </button>
              </div>
            </div>
          </footer>
        )}

        {/* ── Footer: PARTNER_LEFT ── */}
        {chat.status === "PARTNER_LEFT" && (
          <footer className="shrink-0 border-t border-base-300 bg-base-200 p-3">
            <p className="text-center text-xs text-base-content/40 mb-3">
              Your chat partner has left.
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm gap-1.5" onClick={chat.startSearch}>
                <IconNext />
                Find New Stranger
              </button>
              <button className="btn btn-ghost btn-sm gap-1.5" onClick={onClose}>
                <IconLeave />
                Exit
              </button>
            </div>
          </footer>
        )}

      </div>
    </div>
  );
}

// ── Sub-components (identical to your original) ───────────────────────────────

function IdleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-blue-700/10 flex items-center justify-center text-blue-700 mb-2">
        <Dices size={40} />
      </div>
      <div>
        <h3 className="font-bold text-base">Meet a Random Stranger</h3>
        <p className="mt-1 text-sm text-base-content/50 max-w-[260px] mx-auto">
          Completely anonymous · No profile shared · Just a conversation
        </p>
      </div>
      <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-wide mt-2" onClick={onStart}>
        Start Chatting
      </button>
      <ul className="flex flex-col gap-2 text-xs text-base-content/40 mt-1 list-none p-0">
        <li className="flex items-center justify-center gap-2">
          <User size={12} />
          <span>Your identity is never revealed</span>
        </li>
        <li className="flex items-center justify-center gap-2">
          <Zap size={12} />
          <span>Instant match when someone is waiting</span>
        </li>
      </ul>
    </div>
  );
}

function SearchingScreen({ queueSize, onCancel }: { queueSize: number | null; onCancel: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative w-16 h-16 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-blue-700/20 animate-ping" />
        <span className="relative w-12 h-12 rounded-full bg-blue-700/20 flex items-center justify-center text-blue-700">
          <Search size={24} />
        </span>
      </div>
      <div>
        <h3 className="font-bold text-base">Looking for someone...</h3>
        <p className="mt-1 text-sm text-base-content/50">
          {queueSize != null
            ? `${queueSize} ${queueSize === 1 ? "person" : "people"} in queue`
            : "Connecting to matchmaking..."}
        </p>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel search</button>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center text-error mb-2">
        <AlertTriangle size={32} />
      </div>
      <div>
        <h3 className="font-bold text-base">Something went wrong</h3>
        <p className="mt-1 text-sm text-error max-w-[280px] mx-auto">{error ?? "An unexpected error occurred."}</p>
      </div>
      <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm" onClick={onRetry}>Try Again</button>
    </div>
  );
}

function MessageArea({
  messages, myId, partnerTyping, bottomRef, onReply,
}: {
  messages: ChatMessageDto[];
  myId: string;
  partnerTyping: boolean;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  onReply: (r: ReplyTo) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-0.5">
      {messages.map((msg, i) => (
        <Bubble
          key={msg.messageId ?? i}
          msg={msg}
          isMine={msg.senderId === myId}
          allMessages={messages}
          onReply={onReply}
        />
      ))}
      {partnerTyping && (
        <div className="chat chat-start">
          <div className="chat-bubble chat-bubble-neutral flex gap-1 items-center py-3 px-4">
            <span className="typing-dot" />
            <span className="typing-dot" style={{ animationDelay: "0.2s" }} />
            <span className="typing-dot" style={{ animationDelay: "0.4s" }} />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

function Bubble({
  msg, isMine, allMessages, onReply,
}: {
  msg: ChatMessageDto;
  isMine: boolean;
  allMessages: ChatMessageDto[];
  onReply: (r: ReplyTo) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isSystem =
    msg.senderId === "SYSTEM" || msg.messageType === "SYSTEM" || msg.messageType === "USER_LEFT";

  if (isSystem) {
    return (
      <p className="text-center text-[11px] text-base-content/40 py-1.5 select-none">{msg.content}</p>
    );
  }

  const time = msg.timestamp
    ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  const replyToId  = (msg as any).replyToId as string | undefined;
  const repliedMsg = replyToId ? allMessages.find(m => m.messageId === replyToId) : null;
  const truncate   = (s: string, max = 55) => s.length > max ? s.slice(0, max) + "…" : s;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className={`chat ${isMine ? "chat-end" : "chat-start"}`}>
        {!isMine && (
          <div className="chat-header text-[10px] text-base-content/40 mb-0.5">Stranger</div>
        )}
        <div className={`chat-bubble text-sm ${isMine ? "bg-[#1D4ED8] text-white chat-bubble" : "chat-bubble-neutral"} flex flex-col gap-1`}>
          {repliedMsg && (
            <div className="flex gap-1.5 pb-1.5 mb-0.5 border-b border-white/10">
              <div className="w-0.5 rounded-full bg-white/50 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-semibold opacity-80 mb-0.5">
                  {repliedMsg.senderId === msg.senderId ? (isMine ? "You" : "Stranger") : (isMine ? "Stranger" : "You")}
                </p>
                <p className="text-xs opacity-60 leading-tight truncate max-w-[180px]">
                  {truncate(repliedMsg.content)}
                </p>
              </div>
            </div>
          )}
          {msg.content}
        </div>
        {time && <div className="chat-footer opacity-40 text-[10px] mt-0.5">{time}</div>}
      </div>
      {hovered && (
        <div className={`absolute top-1/2 -translate-y-1/2 ${isMine ? "left-2" : "right-2"}`}>
          <button
            className="btn btn-ghost btn-xs btn-circle opacity-50 hover:opacity-100"
            onClick={() => onReply({ messageId: msg.messageId, senderId: msg.senderId, content: msg.content })}
            aria-label="Reply"
          >
            <IconReply />
          </button>
        </div>
      )}
    </div>
  );
}
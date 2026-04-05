// src/components/layout/StrangerChat.tsx
import { useEffect, useRef, useState, useCallback, type KeyboardEvent } from "react";
import { Dices, Zap, Search, AlertTriangle, Plus, Image as ImageIcon, Video, X, Eye, EyeOff, Send, ArrowLeft, Trash2, LogOut } from "lucide-react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useChat } from "../../hooks/useChat";
import { sendMedia } from "../../api/chatApi.service";
import type { ChatMessageDto, ChatStatus, MessageType } from "../../types/Chat.types";

// ── Icons & Config ──────────────────────────────────────────────────────────

const IconShield = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconReply = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 17 4 12 9 7" />
    <path d="M20 18v-2a4 4 0 0 0-4-4H4" />
  </svg>
);

const DOT_CLASS: Record<ChatStatus, string> = {
  IDLE: "bg-base-content/20",
  SEARCHING: "bg-warning animate-pulse",
  CONNECTED: "bg-success shadow-[0_0_8px_rgba(34,197,94,0.5)]",
  PARTNER_LEFT: "bg-error",
  ERROR: "bg-error",
};

const STATUS_LABEL: Record<ChatStatus, string> = {
  IDLE: "Ready",
  SEARCHING: "Finding Match",
  CONNECTED: "Connected",
  PARTNER_LEFT: "Stranger Left",
  ERROR: "Error",
};

interface ReplyTo {
  messageId: string;
  senderId: string;
  content?: string;
  messageType: MessageType;
}

interface MediaPreview {
  file: File;
  url: string;
  type: "IMAGE" | "VIDEO";
  viewOnce: boolean;
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function StrangerChat({ onClose, standalone }: { onClose?: () => void; standalone?: boolean }) {
  const chat = useChat();
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<MediaPreview | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat.messages, chat.partnerTyping]);

  useEffect(() => {
    if (chat.status === "CONNECTED") inputRef.current?.focus();
  }, [chat.status]);

  useEffect(() => {
    if (chat.status !== "CONNECTED") {
      setReplyTo(null);
      setMediaPreview(null);
      setShowAttachMenu(false);
    }
  }, [chat.status]);

  const handleSend = () => {
    if (!draft.trim()) return;
    chat.sendMessage(draft, replyTo?.messageId);
    setDraft("");
    setReplyTo(null);
  };

  const handleFileSelect = (type: "IMAGE" | "VIDEO") => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = type === "IMAGE" ? "image/*" : "video/*";
      fileInputRef.current.click();
    }
    setShowAttachMenu(false);
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setMediaPreview({
      file,
      url,
      type: file.type.startsWith("video/") ? "VIDEO" : "IMAGE",
      viewOnce: false
    });
    e.target.value = "";
  };

  const handleSendMedia = async () => {
    if (!mediaPreview || !chat.session) return;
    setIsUploading(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
      });
      reader.readAsDataURL(mediaPreview.file);
      const base64 = await base64Promise;

      await sendMedia(chat.session.sessionId, {
        type: mediaPreview.type,
        mediaPayload: base64,
        mimeType: mediaPreview.file.type,
        mediaName: mediaPreview.file.name,
        viewOnce: mediaPreview.viewOnce,
        replyToId: replyTo?.messageId
      });
      setMediaPreview(null);
      setReplyTo(null);
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === "Escape") {
      e.preventDefault();
      setReplyTo(null);
      setMediaPreview(null);
      setShowAttachMenu(false);
    }
  };

  const handleNext = useCallback(async () => {
    await chat.leaveSession();
    chat.startSearch();
  }, [chat]);

  const handleBackdrop = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && chat.status !== "CONNECTED" && onClose) onClose();
  };

  const containerBase = standalone
    ? "flex flex-col w-full h-full bg-base-200/50 backdrop-blur-2xl relative overflow-hidden"
    : "flex flex-col w-full md:max-w-2xl h-full md:h-[90vh] md:rounded-3xl overflow-hidden bg-base-200 shadow-2xl backdrop-blur-xl relative border border-base-300";

  const renderContent = () => (
    <div className={containerBase}>
      {/* ── Background Glows (Subtle and Theme-adaptive) ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#1D4ED8]/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/5 blur-[120px] pointer-events-none" />

      {/* ── Header Area (Persistent & Sticky) ── */}
      <div className="shrink-0 z-20">
        <header className={`flex items-center justify-between gap-3 px-4 md:px-6 pb-2 bg-base-300/90 backdrop-blur-xl border-b border-base-300 ${standalone ? "pt-10 md:pt-4" : "pt-3 md:pt-4"}`}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-[#1D4ED8] text-white shadow-lg shadow-[#1D4ED8]/20">
              <Dices size={20} />
            </div>
            <div className="flex flex-col">
              <h1 className="text-base font-bold text-base-content tracking-tight leading-tight">Anonymous Chat</h1>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${DOT_CLASS[chat.status]}`} />
                <span className="text-[9px] text-base-content/50 uppercase tracking-widest font-black">
                  {STATUS_LABEL[chat.status]}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onClose && (
              <button onClick={onClose} className="btn btn-ghost btn-sm btn-square opacity-60 hover:opacity-100">
                <X size={20} />
              </button>
            )}
          </div>
        </header>

        {/* ── Persistent Info Banner ── */}
        {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT") && (
          <div className="px-6 py-2.5 bg-base-200/50 backdrop-blur-md border-b border-base-content/5 flex items-center justify-center">
            <div className="flex items-center gap-2 text-base-content/40 font-bold uppercase tracking-[0.2em] text-[9px]">
              <IconShield />
              <span>Chatting anonymously with local people</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ── */}
      <main className="flex-1 flex flex-col min-h-0 relative z-10">
        <AnimatePresence mode="wait">
          {chat.status === "IDLE" && (
            <motion.div key="idle" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.05 }} className="h-full">
              <IdleScreen onStart={chat.startSearch} />
            </motion.div>
          )}
          {chat.status === "SEARCHING" && (
            <motion.div key="searching" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-full">
              <SearchingScreen queueSize={chat.queueSize} onCancel={chat.cancelSearch} />
            </motion.div>
          )}
          {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT") && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col">
              <MessageArea
                messages={chat.messages ?? []}
                myId={chat.session?.yourAnonymousId ?? ""}
                partnerTyping={chat.partnerTyping}
                bottomRef={bottomRef}
                onReply={(msg) => setReplyTo({ messageId: msg.messageId, senderId: msg.senderId, content: msg.content, messageType: msg.messageType })}
              />
            </motion.div>
          )}
          {chat.status === "ERROR" && (
            <motion.div key="error" className="h-full">
              <ErrorScreen error={chat.error} onRetry={chat.startSearch} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── Footer ── */}
      <footer className="shrink-0 p-4 pb-6 md:pb-6 relative z-30">
        {(chat.status === "CONNECTED" || chat.status === "PARTNER_LEFT") && (
          <div className="max-w-[1000px] mx-auto">
            <AnimatePresence>
              {replyTo && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="mb-3 px-4 py-3 rounded-2xl bg-base-300/50 backdrop-blur-xl border border-base-content/10 flex items-center gap-3">
                  <div className="w-1 rounded-full bg-[#1D4ED8] h-8 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-[#1D4ED8] font-bold uppercase tracking-wider mb-0.5">
                      Replying to {replyTo.senderId === chat.session?.yourAnonymousId ? "yourself" : "stranger"}
                    </p>
                    <p className="text-sm text-base-content/60 truncate">
                      {replyTo.messageType === "TEXT" ? replyTo.content : `[${replyTo.messageType}]`}
                    </p>
                  </div>
                  <button onClick={() => setReplyTo(null)} className="btn btn-ghost btn-xs btn-square">
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {chat.status === "CONNECTED" ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-end gap-2 bg-base-300/50 p-2 rounded-[28px] border border-base-content/10 shadow-inner focus-within:border-[#1D4ED8]/50 transition-colors">
                  <div className="relative group/attach">
                    <button onClick={() => setShowAttachMenu(!showAttachMenu)} className={`btn btn-circle btn-sm h-10 w-10 md:h-11 md:w-11 ${showAttachMenu ? "bg-[#1D4ED8] text-white border-none hover:bg-[#1D4ED8]/90" : "btn-ghost bg-base-100/50"}`}>
                      <Plus className={`transition-transform duration-300 ${showAttachMenu ? "rotate-45" : ""}`} size={20} />
                    </button>
                    <AnimatePresence>
                      {showAttachMenu && (
                        <motion.div initial={{ opacity: 0, scale: 0.9, y: -20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: -20 }} className="absolute bottom-full left-0 mb-4 flex flex-col gap-1 min-w-[200px] p-2 rounded-2xl bg-base-200 border border-base-content/10 shadow-2xl z-50">
                          <button onClick={() => handleFileSelect("IMAGE")} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-300 text-base-content transition-colors">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500"><ImageIcon size={18} /></div>
                            <span className="text-sm font-semibold">Send Image</span>
                          </button>
                          <button onClick={() => handleFileSelect("VIDEO")} className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-base-300 text-base-content transition-colors">
                            <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-500"><Video size={18} /></div>
                            <span className="text-sm font-semibold">Send Video</span>
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <textarea
                    ref={inputRef}
                    rows={1}
                    value={draft}
                    onChange={(e) => { setDraft(e.target.value); chat.notifyTyping(); }}
                    onKeyDown={handleKeyDown}
                    placeholder="Type a message..."
                    className="flex-1 bg-transparent border-none text-base-content focus:ring-0 placeholder-base-content/30 resize-none py-2 md:py-3 px-2 text-sm max-h-32 min-h-[20px]"
                  />
                  <button onClick={handleSend} disabled={!draft.trim()} className="btn bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white btn-circle h-10 w-10 md:h-11 md:w-11 shadow-lg shadow-[#1D4ED8]/20 border-none">
                    <Send size={18} />
                  </button>
                </div>
                <div className="flex items-center justify-between px-1 md:px-2 mt-2 md:mt-4">
                  <div className="flex items-center gap-2 md:gap-4 flex-wrap">
                    <button onClick={handleNext} className="flex items-center gap-1.5 md:gap-2 text-base-content/40 hover:text-[#1D4ED8] transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] leading-none group">
                      <Zap size={13} className="group-hover:fill-current" /> Next
                    </button>
                    <button onClick={() => chat.clearMessages()} className="flex items-center gap-1.5 md:gap-2 text-base-content/40 hover:text-warning transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] leading-none">
                      <Trash2 size={13} /> Clear
                    </button>
                    <button onClick={chat.leaveSession} className="flex items-center gap-1.5 md:gap-2 text-base-content/40 hover:text-red-400 transition-colors text-[9px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em] leading-none">
                      <LogOut size={13} /> Leave
                    </button>
                  </div>
                  <div className="flex items-center gap-2 text-base-content/20 select-none text-[10px] font-black uppercase tracking-[0.2em] leading-none">
                    <IconShield /> <span>Private</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 bg-base-300/30 p-8 rounded-3xl border border-base-content/5 backdrop-blur-md">
                <p className="text-sm text-base-content/50 font-bold uppercase tracking-widest">Stranger disconnected</p>
                <div className="flex gap-3 w-full max-w-sm">
                  <button onClick={chat.startSearch} className="btn bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-[#1D4ED8]/20 border-none">Find Someone New</button>
                  <button onClick={onClose} className="btn bg-base-content/5 border-none flex-1 h-14 rounded-2xl font-black text-xs uppercase tracking-widest">Exit</button>
                </div>
              </div>
            )}
          </div>
        )}
      </footer>

      {/* ── Media Preview Modal ── */}
      <AnimatePresence>
        {mediaPreview && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 z-[100] bg-base-100 h-full w-full flex flex-col">
            <div className="flex items-center justify-between p-6 bg-base-200/50 backdrop-blur-md border-b border-base-300">
              <button onClick={() => setMediaPreview(null)} className="btn btn-ghost btn-square"><ArrowLeft size={20} /></button>
              <h2 className="text-base-content font-black uppercase tracking-[0.2em] text-sm">Preview Media</h2>
              <div className="w-10" />
            </div>
            <div className="flex-1 flex items-center justify-center p-6 bg-black relative">
              {mediaPreview.type === "IMAGE" ? (
                <img src={mediaPreview.url} alt="preview" className="max-w-full max-h-full object-contain" />
              ) : (
                <video src={mediaPreview.url} controls className="max-w-full max-h-full" />
              )}
            </div>
            <div className="p-8 space-y-6 bg-base-100 border-t border-base-300">
              <div className="flex items-center justify-between p-4 rounded-2xl bg-base-200 border border-base-content/10">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${mediaPreview.viewOnce ? "bg-warning/20 text-warning" : "bg-base-content/5 text-base-content/30"}`}>
                    {mediaPreview.viewOnce ? <EyeOff size={20} /> : <Eye size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-base-content">View Once</p>
                    <p className="text-xs text-base-content/40">{mediaPreview.viewOnce ? "Media vanishes after opening" : "Standard permanent view"}</p>
                  </div>
                </div>
                <input type="checkbox" className="toggle border-[#1D4ED8] checked:bg-[#1D4ED8] checked:border-[#1D4ED8] hover:border-[#1D4ED8]" checked={mediaPreview.viewOnce} onChange={(e) => setMediaPreview({ ...mediaPreview, viewOnce: e.target.checked })} />
              </div>
              <button onClick={handleSendMedia} disabled={isUploading} className="btn bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white w-full h-16 rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-2xl shadow-[#1D4ED8]/30 border-none">
                {isUploading ? <span className="loading loading-spinner" /> : <>Send to stranger <Send size={20} className="ml-2" /></>}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <input type="file" ref={fileInputRef} className="hidden" onChange={onFileChange} />
    </div>
  );

  if (chat.restoring) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-base-100 gap-4">
        <span className="loading loading-spinner loading-lg text-[#1D4ED8]" />
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-base-content/30">Syncing Session</p>
      </div>
    );
  }

  return (
    <div className={standalone ? "w-full h-full bg-base-100" : "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm md:p-4"} onClick={handleBackdrop}>
      {renderContent()}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function IdleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 md:p-8 text-center bg-transparent">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-24 h-24 md:w-32 md:h-32 rounded-[40px] md:rounded-[48px] bg-gradient-to-br from-[#1D4ED8]/10 to-[#1D4ED8]/5 flex items-center justify-center text-[#1D4ED8] mb-6 md:mb-8 shadow-inner border border-[#1D4ED8]/10 relative">
        <div className="absolute inset-0 bg-[#1D4ED8]/20 blur-3xl rounded-full scale-50 opacity-50" />
        <Dices size={40} className="md:w-14 md:h-14 relative z-10" />
      </motion.div>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}>
        <h3 className="text-2xl md:text-4xl font-black text-base-content tracking-tighter mb-4">Connect with Neighbors.</h3>
        <p className="text-sm text-base-content/40 max-w-[280px] mx-auto leading-relaxed font-semibold">
          Secure, anonymous, and ephemeral connections with local people in your area.
        </p>
      </motion.div>
      <motion.button initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onStart} className="btn bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white w-full max-w-[280px] h-14 md:h-16 rounded-2xl md:rounded-[24px] font-black text-sm uppercase tracking-[0.2em] mt-8 md:mt-12 shadow-2xl shadow-[#1D4ED8]/20 border-none">
        Start Chatting
      </motion.button>
      <div className="flex flex-col gap-3 mt-12 md:mt-16 text-base-content/20 text-[10px] uppercase font-black tracking-[0.3em]"><IconShield /> <span>Private Relay Active</span></div>
    </div>
  );
}

function SearchingScreen({ queueSize, onCancel }: { queueSize: number | null; onCancel: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
      <div className="relative">
        <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.1, 0.3] }} transition={{ duration: 3, repeat: Infinity }} className="absolute inset-[-60px] rounded-full bg-[#1D4ED8]/20 blur-3xl" />
        <div className="w-24 h-24 rounded-full bg-base-300 border border-base-content/5 flex items-center justify-center relative z-10 shadow-2xl">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="text-[#1D4ED8]"><Search size={40} /></motion.div>
        </div>
      </div>
      <div className="mt-12 space-y-3">
        <h3 className="text-2xl font-black text-base-content tracking-tight">Finding a match...</h3>
        <p className="text-sm text-base-content/40 font-bold uppercase tracking-widest">{queueSize != null ? `${queueSize} people discoverying` : "Scanning network..."}</p>
      </div>
      <button onClick={onCancel} className="btn btn-ghost mt-16 px-10 h-12 rounded-xl text-base-content/40 hover:text-base-content font-black text-[10px] uppercase tracking-[0.3em]">Stop Search</button>
    </div>
  );
}

function ErrorScreen({ error, onRetry }: { error: string | null; onRetry: () => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-8 p-8 text-center bg-transparent">
      <div className="w-20 h-20 rounded-[28px] bg-error/10 flex items-center justify-center text-error shadow-inner border border-error/10"><AlertTriangle size={40} /></div>
      <div>
        <h3 className="text-2xl font-black text-base-content mb-3 tracking-tight">Connection Lost</h3>
        <p className="text-sm text-base-content/40 max-w-[280px] mx-auto leading-relaxed">{error ?? "There was a problem with the chat relay."}</p>
      </div>
      <button onClick={onRetry} className="btn btn-error btn-outline h-14 px-12 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:shadow-xl hover:shadow-error/20 transition-all">Retry Link</button>
    </div>
  );
}

function MessageArea({ messages, myId, partnerTyping, bottomRef, onReply }: { messages: ChatMessageDto[]; myId: string; partnerTyping: boolean; bottomRef: React.RefObject<HTMLDivElement | null>; onReply: (r: { messageId: string; senderId: string; content?: string; messageType: MessageType }) => void }) {
  const hasSentMessage = messages.some(m => m.senderId === myId);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 md:py-8 md:px-8 custom-scrollbar scroll-smooth flex flex-col gap-2">
      <div className="mb-auto" />

      <AnimatePresence>
        {!hasSentMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="flex flex-col items-center gap-4 md:gap-6 p-4 md:p-8 mb-4 md:mb-8 bg-base-300/20 rounded-[32px] border border-base-content/5 backdrop-blur-md text-center max-w-sm mx-auto"
          >
            <div className="space-y-2">
              <h3 className="text-sm font-black uppercase tracking-[0.3em] text-[#1D4ED8]">Chat Controls</h3>
              <p className="text-[10px] text-base-content/30 font-bold uppercase tracking-widest leading-relaxed">
                Before you start, here's how to manage your session:
              </p>
            </div>

            <div className="grid gap-2 md:gap-4 w-full">
              {[
                { icon: <Zap size={14} />, label: "Next Match", desc: "Instantly find a new stranger" },
                { icon: <Trash2 size={14} />, label: "Clear Chat", desc: "Wipe local messages" },
                { icon: <LogOut size={14} />, label: "Leave", desc: "Exit current conversation" }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 md:gap-4 text-left p-2 md:p-3 rounded-xl md:rounded-2xl bg-base-100/40 border border-base-content/5">
                  <div className="p-2 rounded-lg md:rounded-xl bg-[#1D4ED8]/10 text-[#1D4ED8]">{item.icon}</div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-base-content/60">{item.label}</p>
                    <p className="text-[9px] text-base-content/30 font-bold uppercase tracking-wider mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-base-content/20 font-black uppercase tracking-[0.4em] animate-pulse">Waiting for your first message...</p>
          </motion.div>
        )}
      </AnimatePresence>

      {messages.map((msg, i) => <Bubble key={msg.messageId ?? i} msg={msg} isMine={msg.senderId === myId} allMessages={messages} onReply={onReply} />)}
      {partnerTyping && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-start px-2 py-2">
          <div className="flex items-center gap-3 px-4 py-3 rounded-[24px] bg-base-300/80 backdrop-blur-md border border-base-content/5 shadow-sm">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] animate-bounce [animation-duration:0.8s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] animate-bounce [animation-duration:0.8s] [animation-delay:0.2s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#1D4ED8] animate-bounce [animation-duration:0.8s] [animation-delay:0.4s]" />
            </div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-base-content/40">Stranger is typing</span>
          </div>
        </motion.div>
      )}
      <div ref={bottomRef} className="h-4 shrink-0" />
    </div>
  );
}

function Bubble({ msg, isMine, allMessages, onReply }: { msg: ChatMessageDto; isMine: boolean; allMessages: ChatMessageDto[]; onReply: (r: { messageId: string; senderId: string; content?: string; messageType: MessageType }) => void }) {
  const [hovered, setHovered] = useState(false);
  const [showViewOnce, setShowViewOnce] = useState(false);

  const dragX = useMotionValue(0);
  const replyIconScale = useTransform(dragX, [0, 50, 80], [0, 0.8, 1.2]);
  const replyIconOpacity = useTransform(dragX, [0, 50, 80], [0, 0.5, 1]);

  const isSystem = msg.senderId === "SYSTEM" || msg.messageType === "SYSTEM" || msg.messageType === "USER_LEFT" || msg.messageType === "CHAT_ENDED" || msg.messageType === "USER_JOINED";
  if (isSystem) return <div className="w-full flex justify-center py-6 px-10"><p className="text-[10px] text-base-content/20 uppercase tracking-[0.3em] font-black text-center leading-relaxed max-w-[80%]">{msg.content}</p></div>;

  const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  const repliedMsg = msg.replyToId ? allMessages.find(m => m.messageId === msg.replyToId || (m.messageId.startsWith('local-') && m.messageId === msg.replyToId)) : null;
  const truncate = (s: string, max = 50) => s.length > max ? s.slice(0, max) + "..." : s;
  const isMedia = msg.messageType === "IMAGE" || msg.messageType === "VIDEO";

  const renderMedia = () => {
    if (msg.viewOnce && !showViewOnce) return <div onClick={() => setShowViewOnce(true)} className="relative w-72 aspect-video rounded-3xl bg-[#1D4ED8]/10 backdrop-blur-3xl flex flex-col items-center justify-center gap-4 cursor-pointer group/vo border border-[#1D4ED8]/20 hover:bg-[#1D4ED8]/20 transition-colors"><div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-[#1D4ED8] shadow-2xl transition-transform group-hover/vo:scale-110"><EyeOff size={32} /></div><p className="text-[10px] font-black text-[#1D4ED8] uppercase tracking-[0.4em]">Unlock Private Media</p></div>;
    return <div className="relative overflow-hidden rounded-2xl bg-base-100 shadow-2xl ring-1 ring-[#1D4ED8]/10">
      {msg.messageType === "IMAGE" ? <img src={msg.mediaPayload} className="max-w-full max-h-[500px] object-cover cursor-pointer" onClick={() => window.open(msg.mediaPayload, "_blank")} alt="" /> : <video src={msg.mediaPayload} controls className="max-w-full max-h-[500px]" onEnded={() => msg.viewOnce && setShowViewOnce(false)} />}
      {msg.viewOnce && <div className="absolute top-4 right-4 px-3 py-1.5 bg-[#1D4ED8] backdrop-blur-md rounded-xl text-[10px] font-black text-white uppercase tracking-widest flex items-center gap-2 shadow-xl shrink-0"><EyeOff size={14} /> One-Time View</div>}
    </div>;
  };

  const handleDragEnd = (_: any, info: any) => {
    const threshold = isMine ? -60 : 60;
    if ((!isMine && info.offset.x > threshold) || (isMine && info.offset.x < threshold)) {
      onReply({ messageId: msg.messageId, senderId: msg.senderId, content: msg.content, messageType: msg.messageType });
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`relative flex flex-col ${isMine ? "items-end" : "items-start"} group px-1 mb-1`} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>

      {/* Swipe Background Indicator */}
      <motion.div
        style={{ scale: replyIconScale, opacity: replyIconOpacity }}
        className={`absolute top-1/2 -translate-y-1/2 p-2 text-[#1D4ED8]/40 pointer-events-none ${isMine ? "right-2" : "left-2"}`}
      >
        <IconReply />
      </motion.div>

      <motion.div
        drag="x"
        dragConstraints={{ left: isMine ? -100 : 0, right: isMine ? 0 : 100 }}
        dragElastic={0.2}
        style={{ x: dragX }}
        onDragEnd={handleDragEnd}
        onClick={() => onReply({ messageId: msg.messageId, senderId: msg.senderId, content: msg.content, messageType: msg.messageType })}
        className={`max-w-[80%] md:max-w-[65%] rounded-2xl overflow-hidden cursor-pointer select-none relative z-10 transition-shadow 
          ${isMine
            ? "bg-[#1D4ED8] text-white shadow-sm"
            : "bg-base-content/5 backdrop-blur-xl text-base-content border border-base-content/5 shadow-sm"
          } ${isMedia ? "p-1" : "px-3.5 py-2"}`}
      >
        {repliedMsg && (
          <div className={`mb-2 pl-2 border-l-2 transition-colors ${isMine ? "border-white/40 bg-white/5" : "border-[#1D4ED8]/60 bg-[#1D4ED8]/5"
            } py-1.5 pr-2 rounded-r-lg`}>
            <p className={`text-[8px] font-black uppercase tracking-[0.1em] mb-0.5 ${isMine ? "text-white/60" : "text-[#1D4ED8]/70"}`}>
              {repliedMsg.senderId === (isMine ? msg.senderId : "STRANGER") ? "You" : "Stranger"}
            </p>
            <p className={`text-[11px] ${isMine ? "text-white/80" : "text-base-content/50"} truncate leading-none`}>
              {repliedMsg.messageType === "TEXT" ? truncate(repliedMsg.content || "") : `[${repliedMsg.messageType}]`}
            </p>
          </div>
        )}

        {isMedia ? renderMedia() : <p className="text-[13px] whitespace-pre-wrap break-words leading-[1.4] font-medium tracking-tight px-0.5">{msg.content}</p>}

        <div className={`flex items-center gap-2 mt-1 ${isMine ? "justify-end text-white/40" : "justify-start text-base-content/20"}`}>
          <span className="text-[8px] font-bold uppercase tracking-widest">{time}</span>
        </div>
      </motion.div>

      <AnimatePresence>
        {hovered && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            onClick={() => onReply({ messageId: msg.messageId, senderId: msg.senderId, content: msg.content, messageType: msg.messageType })}
            className={`absolute top-1/2 -translate-y-1/2 btn btn-circle btn-xs bg-base-200/50 backdrop-blur-md border border-base-content/10 text-base-content/40 hover:text-[#1D4ED8] transition-all shadow-lg hidden md:flex ${isMine ? "-left-10" : "-right-10"}`}
          >
            <IconReply />
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
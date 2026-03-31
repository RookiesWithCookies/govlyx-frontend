import {
  X,
  BarChart2,
  FileTypeCorner,
  AlertTriangle,
  ImagePlus,
  FileVideo,
  Paperclip,
  Loader2,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import { MdLocationOn } from "react-icons/md";
import { RiAttachment2 } from "react-icons/ri";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, type JSX } from "react";

// ─── API CONFIG ───────────────────────────────────────────────────────────────

/**
 * Gets the JWT stored by your auth flow (localStorage key is configurable).
 */
const getAuthToken = (): string | null =>
  localStorage.getItem("authToken") ?? localStorage.getItem("token") ?? null;

const authHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
type PostType = "post" | "poll";
type Props = {
  open: boolean;
  onClose: () => void;
  communityId?: number;
  communityName?: string;
  onPostCreated?: (post: any) => void;
};

interface ApiResult {
  ok: boolean;
  message?: string;
  data?: any; // the created post/poll from backend
}

// ─── API CALLS ────────────────────────────────────────────────────────────────

/**
 * Civic / Issue Post — POST /api/posts
 */
async function apiCreatePost(content: string, targetPincode: string): Promise<ApiResult> {
  const res = await fetch(`/api/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      content,
      targetPincode,
      broadcastScope: "AREA",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

/**
 * Civic / Issue Post WITH media — POST /api/posts/with-media (multipart)
 */
async function apiCreatePostWithMedia(
  content: string,
  targetPincode: string,
  mediaFile: File
): Promise<ApiResult> {
  const form = new FormData();
  form.append("content", content);
  form.append("targetPincode", targetPincode);
  form.append("media", mediaFile);

  const res = await fetch(`/api/posts/with-media`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

/**
 * Social Post (text-only) — POST /api/social-posts/text
 */
async function apiCreateSocialPost(content: string, communityId?: number): Promise<ApiResult> {
  const res = await fetch(`/api/social-posts/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content, allowComments: true, communityId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

/**
 * Social Post WITH media — POST /api/social-posts/with-media (multipart)
 */
async function apiCreateSocialPostWithMedia(
  content: string,
  files: File[],
  communityId?: number
): Promise<ApiResult> {
  const form = new FormData();
  form.append(
    "post",
    new Blob([JSON.stringify({ content, allowComments: true, communityId })], {
      type: "application/json",
    })
  );
  files.forEach((f) => form.append("media", f));

  const res = await fetch(`/api/social-posts/with-media`, {
    method: "POST",
    headers: { ...authHeaders() },
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

/**
 * Poll Post — POST /api/polls/create
 */
async function apiCreatePoll(payload: {
  question: string;
  options: string[];
  expiresIn: string;
  allowMultipleVotes: boolean;
  showResultsBeforeExpiry?: boolean;
}): Promise<ApiResult> {
  const res = await fetch(`/api/polls/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

// ─── MEDIA UPLOAD ZONE ────────────────────────────────────────────────────────
function MediaUploadZone({
  accent = "blue",
  files,
  onChange,
}: {
  accent?: "blue" | "orange";
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accentBorder = accent === "orange" ? "border-orange-500/40" : "border-blue-700/30";
  const accentBg     = accent === "orange" ? "bg-orange-500/5"      : "bg-blue-700/5";
  const accentText   = accent === "orange" ? "text-orange-400"      : "text-blue-400";
  const accentHover  = accent === "orange" ? "hover:border-orange-500/70" : "hover:border-blue-700/60";

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const arr = Array.from(incoming).slice(0, 4 - files.length);
    onChange([...files, ...arr].slice(0, 4));
  };

  const removeFile = (i: number) => onChange(files.filter((_, idx) => idx !== i));

  return (
    <div className="flex flex-col gap-2">
      <div
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 cursor-pointer transition-colors duration-200 ${accentBorder} ${accentBg} ${accentHover} ${dragging ? "opacity-80 scale-[0.99]" : ""}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
      >
        <div className="flex gap-3">
          <ImagePlus size={20} className={`${accentText} opacity-70`} />
          <FileVideo size={20} className={`${accentText} opacity-70`} />
          <Paperclip size={20} className={`${accentText} opacity-70`} />
        </div>
        <p className={`text-xs font-medium ${accentText}`}>
          Drag & drop or <span className="underline">browse</span> to attach media
        </p>
        <p className="text-base-content/25 text-xs">
          Photos, videos, documents · up to 4 files
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-base-300/60 border border-base-300 rounded-full text-xs text-base-content/60 max-w-[160px]"
            >
              <span className="truncate">{f.name}</span>
              <button
                className="text-base-content/30 hover:text-red-400 flex-shrink-0"
                onClick={(e) => { e.stopPropagation(); removeFile(i); }}
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── STATUS BANNER ─────────────────────────────────────────────────────────────
function StatusBanner({ status, message }: { status: "error" | "success" | "network"; message: string }) {
  const map = {
    error:   { bg: "bg-red-500/10 border-red-500/30 text-red-400",    icon: <X size={14} /> },
    success: { bg: "bg-green-500/10 border-green-500/30 text-green-400", icon: <CheckCircle2 size={14} /> },
    network: { bg: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400", icon: <WifiOff size={14} /> },
  };
  const s = map[status];
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${s.bg}`}
    >
      {s.icon}
      <span>{message}</span>
    </motion.div>
  );
}

// ─── POST FORM (Civic issue + regular post, wired to backend) ─────────────────
function PostForm({
  onClose,
  communityId,
  onPostCreated,
}: {
  onClose: () => void;
  communityId?: number;
  onPostCreated?: (post: any) => void;
}) {
  const [content, setContent]               = useState("");
  const [targetPincode, setTargetPincode]   = useState("");
  const [isReportingIssue, setIsReportingIssue] = useState(false);
  const [files, setFiles]                   = useState<File[]>([]);
  const [loading, setLoading]               = useState(false);
  const [submitted, setSubmitted]           = useState(false);
  const [error, setError]                   = useState<{ type: "error" | "network"; msg: string } | null>(null);

  // ── Validation ──
  const validate = () => {
    if (!content.trim()) { setError({ type: "error", msg: "Please write something before posting." }); return false; }
    if (isReportingIssue && !targetPincode.trim()) {
      setError({ type: "error", msg: "Pincode is required when reporting an issue." }); return false;
    }
    if (isReportingIssue && !/^\d{6}$/.test(targetPincode.trim())) {
      setError({ type: "error", msg: "Please enter a valid 6-digit pincode." }); return false;
    }
    return true;
  };

  // ── Submit ──
  const handlePost = async () => {
    setError(null);
    if (!validate()) return;
    setLoading(true);

    try {
      let result: ApiResult;

      if (isReportingIssue) {
        if (files.length > 0) {
          result = await apiCreatePostWithMedia(content.trim(), targetPincode.trim(), files[0]);
        } else {
          result = await apiCreatePost(content.trim(), targetPincode.trim());
        }
      } else {
        if (files.length > 0) {
          result = await apiCreateSocialPostWithMedia(content.trim(), files, communityId);
        } else {
          result = await apiCreateSocialPost(content.trim(), communityId);
        }
      }

      if (!result.ok) {
        setError({ type: "error", msg: result.message ?? "Something went wrong. Please try again." });
        return;
      }

      setSubmitted(true);
      if (onPostCreated) onPostCreated(result.data);
      window.dispatchEvent(new CustomEvent("postCreated", { detail: { post: result.data, communityId } }));

    } catch (e: unknown) {
      const isNetwork = e instanceof TypeError && e.message.toLowerCase().includes("fetch");
      setError({
        type: isNetwork ? "network" : "error",
        msg: isNetwork
          ? "Network error — check your connection and try again."
          : "Unexpected error. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
          <CheckCircle2 size={48} className={isReportingIssue ? "text-orange-400" : "text-blue-400"} />
        </motion.div>
        <p className="text-base-content font-bold text-lg">
          {isReportingIssue ? "Issue Reported!" : "Post Published!"}
        </p>
        <p className="text-base-content/50 text-sm">
          {isReportingIssue
            ? "Your report has been submitted to the relevant government department."
            : "Your post is now live in the community feed."}
        </p>
        <div className="flex gap-2">
          <button
            className={`btn btn-sm ${isReportingIssue ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-700 hover:bg-blue-800"} text-white`}
            onClick={() => { setSubmitted(false); setContent(""); setFiles([]); setTargetPincode(""); setError(null); }}
          >
            Post Again
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence>
        {error && <StatusBanner status={error.type} message={error.msg} />}
      </AnimatePresence>

      {!communityId && (
        <div
          className={`flex items-center justify-between p-3 rounded-lg border transition-colors duration-200 ${
            isReportingIssue ? "bg-orange-500/10 border-orange-500/40" : "bg-base-300/40 border-base-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle size={15} className={`transition-colors flex-shrink-0 ${isReportingIssue ? "text-orange-400" : "text-base-content/30"}`} />
            <div>
              <p className={`text-xs font-semibold ${isReportingIssue ? "text-orange-400" : "text-base-content/50"}`}>
                Report to Government Department
              </p>
              <p className="text-base-content/30 text-xs text-nowrap">Officially flag this issue to authorities</p>
            </div>
          </div>
          <div
            className="relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 flex-shrink-0"
            style={{ background: isReportingIssue ? "#f97316" : "#374151" }}
            onClick={() => { setIsReportingIssue(!isReportingIssue); setError(null); }}
          >
            <div
              className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
              style={{ transform: isReportingIssue ? "translateX(22px)" : "translateX(2px)" }}
            />
          </div>
        </div>
      )}

      <AnimatePresence>
        {isReportingIssue && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-orange-400/70 uppercase tracking-wider flex items-center gap-1">
                <MdLocationOn size={14} /> Area Pincode <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="e.g. 400001 (Mumbai)"
                className="input input-bordered input-sm focus:border-orange-500 w-full"
                value={targetPincode}
                onChange={(e) => { setTargetPincode(e.target.value.replace(/\D/g, "")); setError(null); }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div>
        <textarea
          placeholder={
            isReportingIssue
              ? "Describe the issue..."
              : "What's on your mind?"
          }
          className={`textarea textarea-bordered w-full min-h-[110px] resize-none transition-colors ${
            isReportingIssue ? "border-orange-500/40 focus:border-orange-500" : "focus:border-blue-700"
          }`}
          value={content}
          onChange={(e) => { setContent(e.target.value); setError(null); }}
        />
      </div>

      <div>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${isReportingIssue ? "text-orange-400/60" : "text-base-content/40"}`}>
          <RiAttachment2 size={14} /> Attach Media (optional)
        </p>
        <MediaUploadZone accent={isReportingIssue ? "orange" : "blue"} files={files} onChange={setFiles} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onClose} className="btn btn-sm btn-ghost" disabled={loading}>Cancel</button>
        <button
          disabled={loading}
          className={`btn btn-sm text-white min-w-[100px] transition-colors duration-200 ${
            isReportingIssue ? "bg-orange-500 hover:bg-orange-600" : "bg-blue-700 hover:bg-blue-800"
          } ${loading ? "opacity-70" : ""}`}
          onClick={handlePost}
        >
          {loading ? (
            <span className="flex items-center gap-1.5">
              <Loader2 size={13} className="animate-spin" />
              Submitting...
            </span>
          ) : (
            "Post"
          )}
        </button>
      </div>
    </div>
  );
}

// ─── POLL FORM (wired to backend) ─────────────────────────────────────────────
function PollForm() {
  const [pollQuestion, setPollQuestion] = useState("");
  const [options, setOptions]           = useState(["", ""]);
  const [errors, setErrors]             = useState<Record<string, string | boolean>>({});
  const [loading, setLoading]           = useState(false);
  const [submitted, setSubmitted]       = useState(false);

  const updateOption = (i: number, val: string) => { const u = [...options]; u[i] = val; setOptions(u); };
  const addOption    = () => { if (options.length < 4) setOptions([...options, ""]); };
  const removeOption = (i: number) => { if (options.length <= 2) return; setOptions(options.filter((_, idx) => idx !== i)); };

  const validate = () => {
    const errs: Record<string, string | boolean> = {};
    if (!pollQuestion.trim()) errs.pollQuestion = "Poll question is required";
    options.forEach((o, i) => { if (!o.trim()) errs[`opt${i}`] = true; });
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePost = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await apiCreatePoll({
        question: pollQuestion.trim(),
        options: options.filter((o) => o.trim()),
        expiresIn: "1d",
        allowMultipleVotes: false,
        showResultsBeforeExpiry: true,
      });
      if (!result.ok) return;
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6 text-center">
        <CheckCircle2 size={48} className="text-blue-400" />
        <p className="font-bold">Poll Posted!</p>
        <button className="btn btn-sm bg-blue-700 text-white" onClick={() => setSubmitted(false)}>Done</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        className={`textarea textarea-bordered w-full min-h-[80px] focus:border-blue-700 ${errors.pollQuestion ? "border-red-500" : ""}`}
        placeholder="Ask your poll question..."
        value={pollQuestion}
        onChange={(e) => setPollQuestion(e.target.value)}
      />
      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            className="input input-bordered flex-1 input-sm focus:border-blue-700"
            placeholder={`Option ${i+1}`}
            value={opt}
            onChange={(e) => updateOption(i, e.target.value)}
          />
          {options.length > 2 && (
            <button className="btn btn-ghost btn-xs text-error" onClick={() => removeOption(i)}><X size={12} /></button>
          )}
        </div>
      ))}
      <button className="btn btn-ghost btn-sm w-full border-dashed" onClick={addOption}>+ Add Option</button>
      <div className="flex justify-end pt-1">
        <button className="btn btn-sm bg-blue-700 text-white min-w-[100px]" onClick={handlePost} disabled={loading}>
          {loading ? <Loader2 size={13} className="animate-spin" /> : "Post Poll"}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
const CreatePost = ({ open, onClose, communityId, communityName, onPostCreated }: Props) => {
  const [type, setType] = useState<PostType>("post");

  const postTypes: { key: PostType; label: string; icon: JSX.Element }[] = [
    { key: "post", label: "Post", icon: <FileTypeCorner size={16} /> },
    { key: "poll", label: "Poll", icon: <BarChart2 size={16} /> },
  ];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/60"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
          >
            <div
              className="w-full max-w-lg rounded-2xl bg-base-200 border border-base-300 p-6 max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col gap-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold">
                    {communityId ? `Post to ${communityName}` : "Create New Post"}
                  </h2>
                </div>
                <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle"><X size={20} /></button>
              </div>

              {!communityId && (
                <div className="grid grid-cols-2 gap-2 bg-base-300 rounded-xl p-1">
                  {postTypes.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => setType(item.key)}
                      className={`btn btn-sm flex-1 ${type === item.key ? "bg-blue-700 text-white shadow-md" : "btn-ghost text-base-content/60"}`}
                    >
                      {item.icon}
                      <span className="ml-2 text-xs font-semibold">{item.label}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1">
                {type === "post" && (
                  <PostForm
                    onClose={onClose}
                    communityId={communityId}
                    onPostCreated={onPostCreated}
                  />
                )}
                {type === "poll" && <PollForm />}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreatePost;
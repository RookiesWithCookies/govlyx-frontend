import {
  X,
  BarChart2,
  FileTypeCorner,
  AlertTriangle,
  ImagePlus,
  FileVideo,
  Paperclip,
  Send,
  Loader2,
  CheckCircle2,
  WifiOff,
} from "lucide-react";
import { HiOutlineArrowRight } from "react-icons/hi";
import { MdLocationOn, MdAccessTime, MdOutlineVisibility } from "react-icons/md";
import { HiLightBulb } from "react-icons/hi";
import { RiAttachment2 } from "react-icons/ri";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, type JSX } from "react";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
// Swap BASE_URL for your actual backend origin in .env or here directly.
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080";

/**
 * Gets the JWT stored by your auth flow (localStorage key is configurable).
 * Adjust the key to match whatever your auth service uses.
 */
const getAuthToken = (): string | null =>
  localStorage.getItem("authToken") ?? localStorage.getItem("token") ?? null;

const authHeaders = (): HeadersInit => {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── TYPES ────────────────────────────────────────────────────────────────────
type PostType = "post" | "poll";
type Props = { open: boolean; onClose: () => void };

interface ApiResult {
  ok: boolean;
  message?: string;
  data?: any; // the created post/poll from backend
}

// ─── API CALLS ────────────────────────────────────────────────────────────────

/**
 * Civic / Issue Post — POST /api/posts
 * Called when user posts as a regular user (or department) WITHOUT media.
 * Body: PostCreateDto JSON { content, targetPincode, broadcastScope? }
 */
async function apiCreatePost(content: string, targetPincode: string): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}/api/posts`, {
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
 * Called when user attaches files.
 * Parts: content (string), targetPincode (string), media (file, optional)
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

  const res = await fetch(`${BASE_URL}/api/posts/with-media`, {
    method: "POST",
    headers: { ...authHeaders() }, // no Content-Type — browser sets multipart boundary
    body: form,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

/**
 * Social Post (text-only) — POST /api/social-posts (text body)
 * SocialPostCreateDto: { content, hashtags?, mentionedUserIds?, allowComments? }
 */
async function apiCreateSocialPost(content: string): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}/api/social-posts/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content, allowComments: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, message: json?.message ?? `HTTP ${res.status}` };
  return { ok: true, message: json?.message, data: json?.data ?? null };
}

/**
 * Social Post WITH media — POST /api/social-posts/with-media (multipart)
 * Parts: content (JSON string), files[] (binary)
 */
async function apiCreateSocialPostWithMedia(
  content: string,
  files: File[]
): Promise<ApiResult> {
  const form = new FormData();
  form.append("post", new Blob([JSON.stringify({ content, allowComments: true })], { type: "application/json" }));
  files.forEach((f) => form.append("media", f));

  const res = await fetch(`${BASE_URL}/api/social-posts/with-media`, {
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
 *
 * Maps directly to PollController.createPoll() → PollService.createPollPost().
 * The backend auto-creates a SocialPost from the question, so we only send:
 *   CreatePollRequest { question, options, expiresIn, allowMultipleVotes, showResultsBeforeExpiry }
 *
 * Field name MUST be `allowMultipleVotes` (matches the Java field in CreatePollRequest).
 */
async function apiCreatePoll(payload: {
  question: string;
  options: string[];
  expiresIn: string;
  allowMultipleVotes: boolean;       // ← matches CreatePollRequest.allowMultipleVotes
  showResultsBeforeExpiry?: boolean; // ← optional; backend defaults to true
}): Promise<ApiResult> {
  const res = await fetch(`${BASE_URL}/api/polls/create`, {   // ← /create not root
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
function PostForm({ onClose }: { onClose: () => void }) {
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
        // ── CIVIC / ISSUE POST ──────────────────────────────────────────────
        // Decision: files attached → multipart endpoint; none → JSON endpoint
        if (files.length > 0) {
          // Backend /api/posts/with-media accepts a single "media" file.
          // Send the first file; if user attached multiple, loop or use first.
          result = await apiCreatePostWithMedia(content.trim(), targetPincode.trim(), files[0]);
        } else {
          result = await apiCreatePost(content.trim(), targetPincode.trim());
        }
      } else {
        // ── SOCIAL POST ────────────────────────────────────────────────────
        // Decision: files attached → multipart; none → JSON text-only
        if (files.length > 0) {
          result = await apiCreateSocialPostWithMedia(content.trim(), files);
        } else {
          result = await apiCreateSocialPost(content.trim());
        }
      }

      if (!result.ok) {
        setError({ type: "error", msg: result.message ?? "Something went wrong. Please try again." });
        return;
      }

      setSubmitted(true);
      // Dispatch the created post data so Home can prepend it instantly
      window.dispatchEvent(new CustomEvent("postCreated", { detail: { post: result.data } }));

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

      {/* ── ERROR/SUCCESS BANNER ── */}
      <AnimatePresence>
        {error && <StatusBanner status={error.type} message={error.msg} />}
      </AnimatePresence>

      {/* ── REPORT ISSUE TOGGLE ── */}
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
            <p className="text-base-content/30 text-xs">Officially flag this issue to the relevant authority</p>
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

      {/* ── PINCODE (only for issue posts) ── */}
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
              <p className="text-base-content/30 text-xs">
                The pincode where this issue is located — used to notify the right local authority.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── TEXTAREA ── */}
      <div>
        <textarea
          placeholder={
            isReportingIssue
              ? "Describe the issue — include exact location, what's wrong, and how long it's been happening…"
              : "What's on your mind? Share an update, opinion, or anything with your community…"
          }
          className={`textarea textarea-bordered w-full min-h-[110px] resize-none transition-colors ${
            isReportingIssue ? "border-orange-500/40 focus:border-orange-500" : "focus:border-blue-700"
          }`}
          value={content}
          onChange={(e) => { setContent(e.target.value); setError(null); }}
        />
        <p className={`text-xs mt-1.5 flex items-center gap-1 ${isReportingIssue ? "text-orange-400/60" : "text-base-content/30"}`}>
          <HiLightBulb size={14} className="flex-shrink-0" />
          <span>
            Tag departments like{" "}
            <span className={`font-semibold ${isReportingIssue ? "text-orange-400/80" : "text-blue-400/70"}`}>@BMC</span>,{" "}
            <span className={`font-semibold ${isReportingIssue ? "text-orange-400/80" : "text-blue-400/70"}`}>@PWD</span>,{" "}
            <span className={`font-semibold ${isReportingIssue ? "text-orange-400/80" : "text-blue-400/70"}`}>@TrafficPolice</span>
          </span>
        </p>
      </div>

      {/* ── MEDIA UPLOAD ── */}
      <div>
        <p className={`text-xs font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1 ${isReportingIssue ? "text-orange-400/60" : "text-base-content/40"}`}>
          <RiAttachment2 size={14} /> {isReportingIssue ? "Evidence / Photos" : "Attach Media (optional)"}
        </p>
        {/* API routing hint shown to help devs understand the decision in dev builds */}
        {files.length > 0 && (
          <p className="text-base-content/25 text-xs mb-1.5 flex items-center">
            {isReportingIssue
              ? <><HiOutlineArrowRight className="mr-1" /> Will call POST /api/posts/with-media (multipart, {files.length} file{files.length > 1 ? "s" : ""})</>
              : <><HiOutlineArrowRight className="mr-1" /> Will call POST /api/social-posts/with-media (multipart, {files.length} file{files.length > 1 ? "s" : ""})</>}
          </p>
        )}
        <MediaUploadZone accent={isReportingIssue ? "orange" : "blue"} files={files} onChange={setFiles} />
      </div>

      {/* ── FOOTER ── */}
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
              Submitting…
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <Send size={13} />
              {isReportingIssue ? "Submit Report" : "Post"}
            </span>
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
  const [expiresIn, setExpiresIn]       = useState("1d");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [errors, setErrors]             = useState<Record<string, string | boolean>>({});
  const [loading, setLoading]           = useState(false);
  const [submitted, setSubmitted]       = useState(false);
  const [apiError, setApiError]         = useState<string | null>(null);

  const updateOption = (i: number, val: string) => { const u = [...options]; u[i] = val; setOptions(u); };
  const addOption    = () => { if (options.length < 4) setOptions([...options, ""]); };
  const removeOption = (i: number) => { if (options.length <= 2) return; setOptions(options.filter((_, idx) => idx !== i)); };

  const validate = () => {
    const errs: Record<string, string | boolean> = {};
    if (!pollQuestion.trim()) errs.pollQuestion = "Poll question is required";
    options.forEach((o, i) => { if (!o.trim()) errs[`opt${i}`] = true; });
    if (options.filter((o) => o.trim()).length < 2) errs.options = "At least 2 options needed";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handlePost = async () => {
    setApiError(null);
    if (!validate()) return;
    setLoading(true);
    try {
      const result = await apiCreatePoll({
        question: pollQuestion.trim(),
        options: options.filter((o) => o.trim()),
        expiresIn,
        allowMultipleVotes: allowMultiple,   // ← maps JS state → Java field name
        showResultsBeforeExpiry: true,
      });
      if (!result.ok) { setApiError(result.message ?? "Failed to post poll."); return; }
      setSubmitted(true);
    } catch {
      setApiError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-6">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}>
          <CheckCircle2 size={48} className="text-blue-400" />
        </motion.div>
        <p className="text-base-content font-bold text-lg">Poll Posted!</p>
        <p className="text-base-content/50 text-sm text-center">Your poll "{pollQuestion}" is now live.</p>
        <button
          className="btn btn-sm bg-blue-700 text-white hover:bg-blue-800"
          onClick={() => { setSubmitted(false); setPollQuestion(""); setOptions(["", ""]); setErrors({}); setApiError(null); }}
        >
          Create Another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AnimatePresence>
        {apiError && <StatusBanner status="error" message={apiError} />}
      </AnimatePresence>

      <div>
        <textarea
          className={`textarea textarea-bordered w-full min-h-[80px] focus:border-blue-700 ${errors.pollQuestion ? "border-red-500" : ""}`}
          placeholder="Ask your poll question… e.g. What's your biggest concern in Mumbai?"
          value={pollQuestion}
          onChange={(e) => setPollQuestion(e.target.value)}
          rows={3}
        />
        {errors.pollQuestion && <p className="text-red-500 text-xs mt-1">{errors.pollQuestion as string}</p>}
      </div>

      <div className="flex justify-between items-center">
        <span className="text-base-content/40 text-xs font-semibold uppercase tracking-wider">Poll Options</span>
        <span className="text-base-content/30 text-xs">{options.length}/4</span>
      </div>

      {options.map((opt, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-700/20 border border-blue-700/40 text-blue-400 flex items-center justify-center text-xs font-bold flex-shrink-0">
            {i + 1}
          </div>
          <input
            type="text"
            className={`input input-bordered flex-1 input-sm focus:border-blue-700 ${errors[`opt${i}`] ? "border-red-500" : ""}`}
            placeholder={i === 0 ? "Option 1" : i === 1 ? "Option 2" : `Option ${i + 1}`}
            value={opt}
            maxLength={200}
            onChange={(e) => updateOption(i, e.target.value)}
          />
          {options.length > 2 && (
            <button className="btn btn-ghost btn-xs text-base-content/30 hover:text-red-400" onClick={() => removeOption(i)}>
              <X size={12} />
            </button>
          )}
        </div>
      ))}

      {errors.options && <p className="text-red-500 text-xs">{errors.options as string}</p>}

      {options.length < 4 && (
        <button className="btn btn-ghost btn-sm w-full border border-dashed border-base-300 text-blue-400 hover:border-blue-700" onClick={addOption}>
          + Add Option
        </button>
      )}

      <div className="flex gap-4 p-3 bg-base-300/50 rounded-lg border border-base-300">
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-base-content/40 text-xs font-semibold uppercase tracking-wider flex items-center gap-1">
            <MdAccessTime size={14} /> Duration
          </span>
          <select className="select select-bordered select-sm focus:border-blue-700" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)}>
            <option value="1d">1 Day</option>
            <option value="3d">3 Days</option>
            <option value="7d">7 Days</option>
            <option value="never">No expiry</option>
          </select>
        </div>
        <div className="flex flex-col gap-2 flex-1">
          <span className="text-base-content/40 text-xs font-semibold uppercase tracking-wider">Multiple choices</span>
          <div className="flex items-center gap-2 mt-0.5">
            <div
              className="relative w-11 h-6 rounded-full cursor-pointer transition-colors duration-200"
              style={{ background: allowMultiple ? "#1d4ed8" : "#374151" }}
              onClick={() => setAllowMultiple(!allowMultiple)}
            >
              <div className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200"
                style={{ transform: allowMultiple ? "translateX(22px)" : "translateX(2px)" }} />
            </div>
            <span className={`text-xs ${allowMultiple ? "text-blue-400" : "text-base-content/30"}`}>{allowMultiple ? "On" : "Off"}</span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(pollQuestion.trim() || options.some((o) => o.trim())) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-blue-900/50 bg-base-300/40 p-4 mt-1"
          >
            <p className="text-blue-700 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
              <MdOutlineVisibility size={14} /> Preview
            </p>
            <p className="text-base-content font-bold text-sm mb-3">{pollQuestion || "Your question here..."}</p>
            {options.map((opt, i) => opt.trim() ? (
              <div key={i} className={`flex items-center justify-between px-3 py-2.5 rounded-lg mb-1.5 text-sm border ${
                i === 0 ? "bg-blue-900/30 border-blue-700/60 text-base-content" : "bg-base-300/50 border-base-300 text-base-content/60"
              }`}>
                <span className="flex-1">{opt}</span>
                <span className={`text-xs font-bold ml-2 ${i === 0 ? "text-blue-400" : "text-base-content/30"}`}>—%</span>
              </div>
            ) : null)}
            <p className="text-base-content/30 text-xs mt-2">0 votes · {expiresIn === "never" ? "No expiry" : `Expires in ${expiresIn}`}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex justify-end gap-2 pt-1">
        <button
          disabled={loading}
          className={`btn btn-sm bg-blue-700 text-white hover:bg-blue-800 min-w-[100px] ${loading ? "opacity-60" : ""}`}
          onClick={handlePost}
        >
          {loading ? (
            <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" />Posting…</span>
          ) : (
            <span className="flex items-center gap-1.5"><Send size={13} />Post Poll</span>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── MAIN MODAL ───────────────────────────────────────────────────────────────
const CreatePost = ({ open, onClose }: Props) => {
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
              className="w-full max-w-lg rounded-xl bg-base-200 border border-base-300 p-4 max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Create Post</h2>
                <button onClick={onClose} className="btn btn-ghost btn-sm"><X size={16} /></button>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2">
                {postTypes.map((item) => (
                  <button
                    key={item.key}
                    onClick={() => setType(item.key)}
                    className={`btn btn-lg mt-1 flex p-0.5 flex-col ${type === item.key ? "bg-blue-700 text-white" : "btn-ghost"} focus:outline-none`}
                  >
                    {item.icon}
                    <span className="text-xs">{item.label}</span>
                  </button>
                ))}
              </div>

              {type === "post" && <PostForm onClose={onClose} />}
              {type === "poll" && <PollForm />}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CreatePost;
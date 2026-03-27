import { useState, useEffect } from "react";
import {
  ShieldCheck,
  FileText,
  MessageSquare,
  ThumbsUp,
  Bookmark,
  CheckCircle,
  Clock,
  BarChart2,
  Share2,
  ArrowUp,
  ArrowDown,
  Eye,
  BadgeCheck,
  Globe,
  MapPin,
  Trash2,
} from "lucide-react";
import EmptyState from "../components/ui/EmptyState";
import ProfileTabs from "../components/profile/ProfileTabs";
import CommentSection from "../components/post/CommentSection";

// ─── auth helpers ─────────────────────────────────────────────────────────────
function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem("authToken") ?? localStorage.getItem("token") ?? "";
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function apiFetch(url: string) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

async function apiPost(url: string, body: any = {}) {
  console.log(`[API POST] ${url}`, body);
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    console.error(`[API POST ERROR] ${url} - Status: ${res.status}`);
    try {
      const err = await res.json();
      console.error("[API POST ERROR BODY]", err);
    } catch {
      // ignore
    }
    throw new Error(`${res.status}`);
  }
  const data = await res.json().catch(() => null);
  console.log(`[API POST SUCCESS] ${url}`, data);
  return data;
}

async function apiDelete(url: string) {
  const res = await fetch(url, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json().catch(() => null);
}

// ─── share helper ─────────────────────────────────────────────────────────────
async function handleShareAction(
  postType: "posts" | "social-posts",
  id: number
) {
  const shareUrl = `${window.location.origin}/${postType}/${id}`;
  try {
    await navigator.clipboard.writeText(shareUrl);
  } catch {
    window.prompt("Copy link:", shareUrl);
  }
  apiPost(
    `/api/${postType}/interactions/${id}/share?shareType=LINK_COPY`,
    {}
  ).catch(() => {});
}

function useCopiedToast() {
  const [copied, setCopied] = useState(false);
  function flash() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return { copied, flash };
}

// ─── date helpers ─────────────────────────────────────────────────────────────
function formatDate(raw: any): string {
  if (raw === null || raw === undefined || raw === "") return "Unknown";
  let d: Date;
  if (Array.isArray(raw)) {
    d = new Date(
      raw[0],
      raw[1] - 1,
      raw[2] ?? 1,
      raw[3] ?? 0,
      raw[4] ?? 0,
      raw[5] ?? 0
    );
  } else {
    const ms = Number(raw);
    d = isNaN(ms) ? new Date(raw as string) : new Date(ms);
  }
  if (isNaN(d.getTime())) return "Unknown";
  return d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
}

function timeAgo(raw: any): string {
  if (raw === null || raw === undefined || raw === "") return "";
  let d: Date;
  if (Array.isArray(raw)) {
    d = new Date(
      raw[0],
      raw[1] - 1,
      raw[2] ?? 1,
      raw[3] ?? 0,
      raw[4] ?? 0,
      raw[5] ?? 0
    );
  } else {
    const ms = Number(raw);
    d = isNaN(ms) ? new Date(raw as string) : new Date(ms);
  }
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── types ────────────────────────────────────────────────────────────────────
type BroadcastScope = "AREA" | "DISTRICT" | "STATE" | "COUNTRY";

type IssuePost = {
  id: number;
  content: string;
  status: "ACTIVE" | "RESOLVED";
  createdAt: string;
  likeCount?: number;
  dislikeCount?: number;
  commentCount?: number;
  viewCount?: number;
  shareCount?: number;
  isLikedByCurrentUser?: boolean;
  isDislikedByCurrentUser?: boolean;
  isSaved?: boolean;
  canDelete?: boolean;
};

type SocialPost = {
  id: number;
  content: string;
  createdAt: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  mediaUrls?: string[];
  hashtags?: string[];
  isLikedByCurrentUser?: boolean;
  isSavedByCurrentUser?: boolean;
  variant?: "social" | "poll" | "community" | "government";
  poll?: PollSummaryDto;
  // government extras
  department?: string;
  broadcastScope?: BroadcastScope;
  broadcastScopeDescription?: string;
  canDelete?: boolean;
  canEdit?: boolean;
  isPoll?: boolean;
  pollId?: number;
};

type PollOptionDto = {
  id: number;
  optionText: string;
  voteCount: number;
  percentage: number;
};

type PollSummaryDto = {
  pollId: number;
  question: string;
  options: PollOptionDto[];
  totalVotes: number;
  allowMultipleVotes: boolean;
  isExpired: boolean;
  timeLeft?: string;
  userHasVoted: boolean;
  votedOptionIds: number[];
  showResults: boolean;
};

type ActivityItem = {
  id: string;
  type: "like" | "comment" | "save";
  label: string;
  detail: string;
  time: string;
  icon: "like" | "comment" | "save";
};

type PostFilter = "all" | "active" | "resolved";
type Tab = "posts" | "social" | "activity";

// current user passed down from auth context / store — adjust to match your app
type CurrentUserInfo = {
  username: string;
  role: "ROLE_USER" | "ROLE_DEPARTMENT" | "ROLE_ADMIN";
};

// ─── shared ActionBtn ─────────────────────────────────────────────────────────
function ActionBtn({
  onClick,
  active = false,
  activeClass = "bg-primary/15 text-primary",
  disabled = false,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  activeClass?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-colors disabled:opacity-40
        ${active ? activeClass : "opacity-60 hover:opacity-100"}`}
    >
      {children}
    </button>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────
function StatCard({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-xl bg-base-200 p-3 text-center">
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-xs opacity-70">{label}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// IssuePostCard
// Endpoints: /api/interactions/posts/{id}/like|dislike|save|share
// ═══════════════════════════════════════════════════════════════════════════════
function IssuePostCard({
  post,
  currentUser,
  onDelete,
}: {
  post: IssuePost;
  currentUser?: CurrentUserInfo;
  onDelete?: (id: number) => void;
}) {
  const [liked, setLiked]               = useState(!!post.isLikedByCurrentUser);
  const [disliked, setDisliked]         = useState(!!post.isDislikedByCurrentUser);
  const [saved, setSaved]               = useState(!!post.isSaved);
  const [likeCount, setLikeCount]       = useState(post.likeCount ?? 0);
  const [dislikeCount, setDislikeCount] = useState(post.dislikeCount ?? 0);
  const [shareCount, setShareCount]     = useState(post.shareCount ?? 0);
  const { copied, flash }               = useCopiedToast();
  const isResolved = post.status === "RESOLVED";

  async function handleLike() {
    if (isResolved) return;
    const next = !liked;
    setLiked(next);
    if (next && disliked) {
      setDisliked(false);
      setDislikeCount((n) => Math.max(0, n - 1));
    }
    setLikeCount((n) => (next ? n + 1 : Math.max(0, n - 1)));
    try {
      console.log(`[LIKE] Toggling issue like for ${post.id}`);
      const res = await apiPost(`/api/posts/interactions/${post.id}/like`, {});
      const data = res?.data ?? res;
      if (data && typeof data.isLiked === "boolean") {
        setLiked(data.isLiked);
      }
      if (data && typeof data.newLikeCount === "number") {
        setLikeCount(data.newLikeCount);
      }
    } catch (err) {
      console.error(`[LIKE ERROR] Issue ${post.id}`, err);
      setLiked(!next);
      setLikeCount((n) => (next ? Math.max(0, n - 1) : n + 1));
    }
  }

  async function handleDislike() {
    if (isResolved) return;
    alert("Dislike feature coming soon!");
  }
  
  async function handleSave() {
    const prevSaved = saved;
    const nextSaved = !prevSaved;
    setSaved(nextSaved);
    try {
      const res = await apiPost(`/api/posts/interactions/${post.id}/save`, {});
      const data = res?.data ?? res;
      if (data && typeof data.isSaved === "boolean") {
        setSaved(data.isSaved);
      }
    } catch { 
      setSaved(prevSaved); 
    }
  }

  async function handleShare() {
    flash();
    setShareCount((n) => n + 1);
    await handleShareAction("posts", post.id);
  }

  return (
    <div className="rounded-xl bg-base-200 p-4 space-y-2">
      {/* Status + time */}
      <div className="flex items-center justify-between">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            isResolved
              ? "bg-green-100 text-green-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {isResolved ? "✓ Resolved" : "● Active"}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-50">{timeAgo(post.createdAt)}</span>
          {post.canDelete && (
            <button 
              onClick={() => onDelete?.(post.id)}
              className="text-error opacity-60 hover:opacity-100 p-1 transition-opacity"
              title="Delete issue"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm line-clamp-3">{post.content}</p>

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 flex-wrap">
        <ActionBtn onClick={handleLike} active={liked} disabled={isResolved}>
          <ArrowUp size={14} /><span>{likeCount}</span>
        </ActionBtn>
        <ActionBtn
          onClick={handleDislike}
          active={disliked}
          activeClass="bg-error/15 text-error"
          disabled={isResolved}
        >
          <ArrowDown size={14} /><span>{dislikeCount}</span>
        </ActionBtn>
        <span className="flex items-center gap-1 px-2 py-1 text-xs opacity-50">
          <Eye size={14} />{post.viewCount ?? 0}
        </span>
        <ActionBtn
          onClick={handleSave}
          active={saved}
          activeClass="bg-accent/15 text-accent"
        >
          <Bookmark size={14} className={saved ? "fill-current" : ""} />
        </ActionBtn>
        <ActionBtn
          onClick={handleShare}
          active={copied}
          activeClass="text-success"
        >
          <Share2 size={14} />
          <span>
            {copied ? "Copied!" : shareCount > 0 ? String(shareCount) : "Share"}
          </span>
        </ActionBtn>
      </div>

      {/* Comment section — hidden when resolved */}
      {isResolved ? (
        <div className="flex items-center gap-1.5 rounded-lg bg-base-300/50 px-3 py-2 text-xs opacity-50">
          <MessageSquare size={12} />
          Comments are closed — this issue has been resolved.
        </div>
      ) : (
        <CommentSection
          postId={post.id}
          postType="post"
          commentCount={post.commentCount ?? 0}
          currentUsername={currentUser?.username}
          currentRole={currentUser?.role}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// GovernmentBroadcastCard
// ═══════════════════════════════════════════════════════════════════════════════
function GovernmentBroadcastCard({
  post,
  currentUser,
  onDelete,
}: {
  post: SocialPost;
  currentUser?: CurrentUserInfo;
  onDelete?: (id: number) => void;
}) {
  const [saved, setSaved]           = useState(!!post.isSavedByCurrentUser);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const { copied, flash }           = useCopiedToast();

  async function handleSave() {
    const prevSaved = saved;
    const nextSaved = !prevSaved;
    setSaved(nextSaved);
    try {
      const res = await apiPost(`/api/social-posts/interactions/${post.id}/save`, {});
      const data = res?.data ?? res;
      if (data && typeof data.isSaved === "boolean") {
        setSaved(data.isSaved);
      }
    } catch { setSaved(prevSaved); }
  }

  async function handleShare() {
    flash();
    setShareCount((n) => n + 1);
    await handleShareAction("social-posts", post.id);
  }

  function scopeLabel() {
    if (post.broadcastScopeDescription) return post.broadcastScopeDescription;
    const map: Record<string, string> = {
      AREA: "Area", DISTRICT: "District", STATE: "State", COUNTRY: "National",
    };
    return post.broadcastScope ? (map[post.broadcastScope] ?? "Broadcast") : "Broadcast";
  }

  const isNational =
    post.broadcastScope === "STATE" || post.broadcastScope === "COUNTRY";

  return (
    <div className="rounded-xl border border-info/30 bg-info/5 p-4 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 font-semibold text-info text-sm">
            <BadgeCheck size={15} />{post.department ?? "Government"}
          </span>
          <span className="inline-flex items-center gap-0.5 rounded-full bg-base-300 px-2 py-0.5 text-xs opacity-70">
            {isNational ? <Globe size={10} /> : <MapPin size={10} />}
            {scopeLabel()}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-50">{timeAgo(post.createdAt)}</span>
          {post.canDelete && (
            <button 
              onClick={() => onDelete?.(post.id)}
              className="text-error opacity-60 hover:opacity-100 p-1 transition-opacity"
              title="Delete broadcast"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm line-clamp-3">{post.content}</p>

      <div className="flex items-center gap-1 pt-1 flex-wrap">
        <span className="flex items-center gap-1 px-2 py-1 text-xs opacity-50">
          <MessageSquare size={14} />{post.commentCount ?? 0}
        </span>
        <ActionBtn
          onClick={handleSave}
          active={saved}
          activeClass="bg-accent/15 text-accent"
        >
          <Bookmark size={14} className={saved ? "fill-current" : ""} />
        </ActionBtn>
        <ActionBtn onClick={handleShare} active={copied} activeClass="text-success">
          <Share2 size={14} />
          <span>
            {copied ? "Copied!" : shareCount > 0 ? String(shareCount) : "Share"}
          </span>
        </ActionBtn>
      </div>

      {/* Comment section */}
      <CommentSection
        postId={post.id}
        postType="social-posts"
        commentCount={post.commentCount ?? 0}
        currentUsername={currentUser?.username}
        currentRole={currentUser?.role}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PollCard (profile version)
// ═══════════════════════════════════════════════════════════════════════════════
function PollCard({
  post,
  currentUser,
  onDelete,
}: {
  post: SocialPost;
  currentUser?: CurrentUserInfo;
  onDelete?: (id: number) => void;
}) {
  const p = post.poll!;
  const [options, setOptions]       = useState<PollOptionDto[]>(p.options ?? []);
  const [totalVotes, setTotalVotes] = useState(p.totalVotes);
  const [hasVoted, setHasVoted]     = useState(p.userHasVoted);
  const [selected, setSelected]     = useState<number[]>(p.votedOptionIds ?? []);
  const [voting, setVoting]         = useState(false);
  const [saved, setSaved]           = useState(!!post.isSavedByCurrentUser);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const { copied, flash }           = useCopiedToast();

  const canVote     = !hasVoted && !p.isExpired;
  const showResults = hasVoted || p.showResults || p.isExpired;

  function toggle(id: number) {
    if (!canVote) return;
    setSelected((prev) =>
      p.allowMultipleVotes
        ? prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        : [id]
    );
  }

  async function submitVote() {
    if (!selected.length || voting) return;
    setVoting(true);
    try {
      await apiPost(`/api/polls/${p.pollId}/vote`, selected);
      const newOpts = options.map((o) => ({
        ...o,
        voteCount: o.voteCount + (selected.includes(o.id) ? 1 : 0),
      }));
      const newTotal = totalVotes + selected.length;
      setOptions(
        newOpts.map((o) => ({
          ...o,
          percentage:
            newTotal > 0 ? Math.round((o.voteCount / newTotal) * 100) : 0,
        }))
      );
      setTotalVotes(newTotal);
      setHasVoted(true);
    } catch {
      setSelected(p.votedOptionIds ?? []);
    } finally {
      setVoting(false);
    }
  }

  async function handleSave() {
    const prevSaved = saved;
    const nextSaved = !prevSaved;
    setSaved(nextSaved);
    try {
      const res = await apiPost(`/api/social-posts/interactions/${post.id}/save`, {});
      const data = res?.data ?? res;
      if (data && typeof data.isSaved === "boolean") {
        setSaved(data.isSaved);
      }
    } catch { setSaved(prevSaved); }
  }

  async function handleShare() {
    flash();
    setShareCount((n) => n + 1);
    await handleShareAction("social-posts", post.id);
  }

  return (
    <div className="rounded-xl bg-base-200 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <BarChart2 size={13} /> Poll
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-50">{timeAgo(post.createdAt)}</span>
          {post.canDelete && (
            <button 
              onClick={() => onDelete?.(post.id)}
              className="text-error opacity-60 hover:opacity-100 p-1 transition-opacity"
              title="Delete poll"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-sm font-semibold">{p.question}</p>

      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isVotedFor = (p.votedOptionIds ?? []).includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggle(opt.id)}
              disabled={!canVote}
              className={`relative w-full overflow-hidden rounded-lg border text-left transition-colors
                ${isSelected && !hasVoted ? "border-primary ring-1 ring-primary/30" : isVotedFor ? "border-primary/60" : "border-base-300"}
                ${canVote ? "cursor-pointer hover:border-primary/60 hover:bg-base-300/30" : "cursor-default"}`}
            >
              {showResults && (
                <div
                  className={`absolute left-0 top-0 h-full transition-all duration-500
                    ${isVotedFor ? "bg-primary/20" : "bg-base-300/50"}`}
                  style={{ width: `${opt.percentage}%` }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {canVote && (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2
                        ${isSelected ? "border-primary bg-primary" : "border-base-content/30"}`}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  )}
                  {opt.optionText}
                </span>
                {showResults && (
                  <span className={`font-semibold ${isVotedFor ? "text-primary" : "opacity-60"}`}>
                    {opt.percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {canVote && selected.length > 0 && (
        <button onClick={submitVote} disabled={voting} className="btn bg-primary text-primary-content font-semibold border-none hover:bg-primary/90 btn-sm w-full">
          {voting ? "Submitting…" : "Vote"}
        </button>
      )}

      <div className="flex items-center gap-1 pt-1 flex-wrap">
        <span className="text-xs opacity-50">{totalVotes.toLocaleString()} votes</span>
        {(p.timeLeft || p.isExpired) && (
          <span className="flex items-center gap-1 text-xs opacity-50 ml-1">
            <Clock size={11} />
            {p.isExpired ? "Poll ended" : p.timeLeft}
          </span>
        )}
        {hasVoted && !p.isExpired && (
          <span className="text-xs text-success ml-1">✓ Voted</span>
        )}
        <ActionBtn
          onClick={handleSave}
          active={saved}
          activeClass="bg-accent/15 text-accent"
          
        >
          <Bookmark size={13} className={saved ? "fill-current" : ""} />
        </ActionBtn>
        <ActionBtn onClick={handleShare} active={copied} activeClass="text-success">
          <Share2 size={13} />
          <span>
            {copied ? "Copied!" : shareCount > 0 ? String(shareCount) : "Share"}
          </span>
        </ActionBtn>
      </div>

      {/* Comment section */}
      <CommentSection
        postId={post.id}
        postType="social-posts"
        commentCount={post.commentCount ?? 0}
        currentUsername={currentUser?.username}
        currentRole={currentUser?.role}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SocialPostCard
// ═══════════════════════════════════════════════════════════════════════════════
function SocialPostCard({
  post,
  currentUser,
  onDelete,
}: {
  post: SocialPost;
  currentUser?: CurrentUserInfo;
  onDelete?: (id: number) => void;
}) {
  if (post.variant === "poll" && post.poll) return <PollCard post={post} currentUser={currentUser} onDelete={onDelete} />;
  if (post.variant === "government") return <GovernmentBroadcastCard post={post} currentUser={currentUser} onDelete={onDelete} />;

  const [liked, setLiked]           = useState(!!post.isLikedByCurrentUser);
  const [saved, setSaved]           = useState(!!post.isSavedByCurrentUser);
  const [likeCount, setLikeCount]   = useState(post.likeCount ?? 0);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const { copied, flash }           = useCopiedToast();

  async function handleLike() {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => (next ? n + 1 : Math.max(0, n - 1)));
    try {
      console.log(`[LIKE] Toggling social like for ${post.id}`);
      const res = await apiPost(`/api/social-posts/interactions/${post.id}/like`, {});
      const data = res?.data ?? res;
      if (data && typeof data.isLiked === "boolean") {
        setLiked(data.isLiked);
      }
      if (data && typeof data.newLikeCount === "number") {
        setLikeCount(data.newLikeCount);
      }
    } catch (err) {
      console.error(`[LIKE ERROR] Social ${post.id}`, err);
      setLiked(!next);
      setLikeCount((n) => (next ? Math.max(0, n - 1) : n + 1));
    }
  }

  async function handleSave() {
    const prevSaved = saved;
    const nextSaved = !prevSaved;
    setSaved(nextSaved);
    try {
      const res = await apiPost(`/api/social-posts/interactions/${post.id}/save`, {});
      const data = res?.data ?? res;
      if (data && typeof data.isSaved === "boolean") {
        setSaved(data.isSaved);
      }
    } catch { setSaved(prevSaved); }
  }

  async function handleShare() {
    flash();
    setShareCount((n) => n + 1);
    await handleShareAction("social-posts", post.id);
  }

  return (
    <div className="rounded-xl bg-base-200 p-4 space-y-2">
      <div className="flex justify-between items-start">
        <p className="text-sm line-clamp-3 flex-1">{post.content}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs opacity-50">{timeAgo(post.createdAt)}</span>
          {post.canDelete && (
            <button 
              onClick={() => onDelete?.(post.id)}
              className="text-error opacity-60 hover:opacity-100 p-1 transition-opacity"
              title="Delete post"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      {post.mediaUrls && post.mediaUrls.length > 0 && (
        <div className="flex gap-2 mt-1 overflow-x-auto">
          {post.mediaUrls.slice(0, 3).map((url, i) => (
            <img
              key={i}
              src={url}
              alt="media"
              className="h-16 w-16 rounded-lg object-cover shrink-0"
            />
          ))}
        </div>
      )}

      {post.hashtags && post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {post.hashtags.map((tag) => (
            <span key={tag} className="text-xs text-primary opacity-80">{tag}</span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1 pt-1 flex-wrap">
        <ActionBtn onClick={handleLike} active={liked}>
          <ArrowUp size={14} /><span>{likeCount}</span>
        </ActionBtn>
        <span className="flex items-center gap-1 px-2 py-1 text-xs opacity-50">
          <MessageSquare size={14} />{post.commentCount ?? 0}
        </span>
        <ActionBtn onClick={handleSave} active={saved} activeClass="bg-accent/15 text-accent">
          <Bookmark size={14} className={saved ? "fill-current" : ""} />
        </ActionBtn>
        <ActionBtn onClick={handleShare} active={copied} activeClass="text-success">
          <Share2 size={14} />
          <span>
            {copied ? "Copied!" : shareCount > 0 ? String(shareCount) : "Share"}
          </span>
        </ActionBtn>
      </div>

      {/* Comment section */}
      <CommentSection
        postId={post.id}
        postType="social-posts"
        commentCount={post.commentCount ?? 0}
        currentUsername={currentUser?.username}
        currentRole={currentUser?.role}
      />
    </div>
  );
}

// ─── ActivityIcon ─────────────────────────────────────────────────────────────
function ActivityIcon({ type }: { type: ActivityItem["icon"] }) {
  const cls =
    "w-7 h-7 rounded-full flex items-center justify-center shrink-0";
  if (type === "like")
    return (
      <div className={`${cls} bg-pink-100 text-pink-600`}>
        <ThumbsUp size={13} />
      </div>
    );
  if (type === "comment")
    return (
      <div className={`${cls} bg-primary/15 text-primary`}>
        <MessageSquare size={13} />
      </div>
    );
  return (
    <div className={`${cls} bg-yellow-100 text-yellow-600`}>
      <Bookmark size={13} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Profile page
// ═══════════════════════════════════════════════════════════════════════════════
const Profile = () => {
  const [tab, setTab]               = useState<Tab>("posts");
  const [postFilter, setPostFilter] = useState<PostFilter>("all");

  async function handleDelete(type: 'posts' | 'social-posts', id: number) {
    if (!window.confirm("Are you sure you want to delete this content? This action cannot be undone.")) return;
    try {
      await apiDelete(`/api/${type}/${id}`);
      if (type === 'posts') {
        setAllPosts(prev => prev.filter(p => p.id !== id));
        setActivePosts(prev => prev.filter(p => p.id !== id));
        setResolvedPosts(prev => prev.filter(p => p.id !== id));
        setIssueCount(n => Math.max(0, n - 1));
      } else {
        setSocialPosts(prev => prev.filter(p => p.id !== id));
        setSocialCount(n => Math.max(0, n - 1));
      }
    } catch (err) {
      console.error("Delete failed", err);
      alert("Failed to delete content. Please try again later.");
    }
  }

  const [username, setUsername]         = useState<string>("...");
  const [avatarLetter, setAvatarLetter] = useState("U");
  const [memberSince, setMemberSince]   = useState("");
  const [location, setLocation]         = useState("India");
  const [currentUser, setCurrentUser]   = useState<CurrentUserInfo | undefined>();

  const [issueCount, setIssueCount]         = useState<number>(0);
  const [socialCount, setSocialCount]       = useState<number>(0);
  const [communityCount, setCommunityCount] = useState<number>(0);

  const [allPosts, setAllPosts]           = useState<IssuePost[]>([]);
  const [activePosts, setActivePosts]     = useState<IssuePost[]>([]);
  const [resolvedPosts, setResolvedPosts] = useState<IssuePost[]>([]);
  const [socialPosts, setSocialPosts]     = useState<SocialPost[]>([]);
  const [activity, setActivity]           = useState<ActivityItem[]>([]);

  const [loadingPosts, setLoadingPosts]       = useState(false);
  const [loadingSocial, setLoadingSocial]     = useState(false);
  const [loadingActivity, setLoadingActivity] = useState(false);

  // Fetch user profile
  useEffect(() => {
    apiFetch("/api/users/me")
      .then((body) => {
        const u = body?.data;
        if (!u) return;
        const name = u.actualUsername ?? u.username ?? "User";
        setUsername(name);
        setAvatarLetter(name.charAt(0).toUpperCase());
        if (u.createdAt !== undefined && u.createdAt !== null)
          setMemberSince(formatDate(u.createdAt));
        if (u.pincode) setLocation(u.pincode);
        else if (u.address) setLocation(u.address);
        // store current user for comment ownership
        setCurrentUser({
          username: name,
          role: u.role ?? "ROLE_USER",
        });
      })
      .catch(() => {});
  }, []);

  // Fetch counts + pre-populate lists
  useEffect(() => {
    apiFetch("/api/posts/my-posts?limit=100")
      .then((b) => {
        const posts: IssuePost[] = b?.data?.content ?? [];
        setAllPosts(posts);
        setIssueCount(posts.length);
      })
      .catch(() => {});

    apiFetch("/api/social-posts/my-posts?limit=100")
      .then((b) => {
        const rawPosts: any[] = b?.data?.content ?? [];
        // Map backend pollData to the Profile's expected `poll` field
        const posts: SocialPost[] = rawPosts.map((p: any) => {
          if (p.isPoll && p.pollData) {
            return {
              ...p,
              variant: "poll" as const,
              poll: {
                pollId: p.pollData.pollId,
                question: p.pollData.question ?? p.content,
                options: (p.pollData.options ?? []).map((o: any) => ({
                  id: o.id,
                  optionText: o.optionText,
                  voteCount: o.voteCount ?? 0,
                  percentage: o.percentage ?? 0,
                })),
                totalVotes: p.pollData.totalVotes ?? 0,
                allowMultipleVotes: p.pollData.allowMultipleVotes ?? false,
                isExpired: p.pollData.isExpired ?? false,
                timeLeft: p.pollData.timeLeft,
                userHasVoted: p.pollData.userHasVoted ?? false,
                votedOptionIds: p.pollData.votedOptionIds ?? [],
                showResults: p.pollData.showResults ?? false,
              } as PollSummaryDto,
            } as SocialPost;
          }
          return p as SocialPost;
        });
        setSocialCount(posts.length);
        setSocialPosts(posts);
      })
      .catch(() => {});

    apiFetch("/api/communities/me?limit=100")
      .then((b) => setCommunityCount(b?.data?.content?.length ?? 0))
      .catch(() => {});
  }, []);

  // Fetch issue filter data on demand
  useEffect(() => {
    if (tab !== "posts") return;
    if (postFilter === "all") return;
    if (postFilter === "active" && activePosts.length > 0) return;
    if (postFilter === "resolved" && resolvedPosts.length > 0) return;

    setLoadingPosts(true);
    const url =
      postFilter === "active"
        ? "/api/posts/my-posts/active?limit=50"
        : "/api/posts/my-posts/resolved?limit=50";

    apiFetch(url)
      .then((b) => {
        const posts: IssuePost[] = b?.data?.content ?? [];
        if (postFilter === "active") setActivePosts(posts);
        if (postFilter === "resolved") setResolvedPosts(posts);
      })
      .catch(() => {})
      .finally(() => setLoadingPosts(false));
  }, [tab, postFilter]);

  // Fetch social posts on tab open
  useEffect(() => {
    if (tab !== "social") return;
    if (socialPosts.length > 0) return;
    setLoadingSocial(true);
    apiFetch("/api/social-posts/my-posts?limit=50")
      .then((b) => setSocialPosts(b?.data?.content ?? []))
      .catch(() => {})
      .finally(() => setLoadingSocial(false));
  }, [tab]);

  // Fetch activity
  useEffect(() => {
    if (tab !== "activity") return;
    if (activity.length > 0) return;
    setLoadingActivity(true);

    Promise.allSettled([
      apiFetch("/api/interactions/saved/social-posts?page=0&size=30"),
      apiFetch("/api/interactions/saved/posts?page=0&size=30"),
    ])
      .then(([savedSocialRes, savedPostsRes]) => {
        const items: ActivityItem[] = [];

        if (savedSocialRes.status === "fulfilled") {
          const rows: any[] = savedSocialRes.value?.data?.content ?? [];
          rows.forEach((row) => {
            const sp = row.socialPost ?? row;
            const text = sp.content ?? "Social post";
            items.push({
              id: `save-sp-${sp.id ?? row.id}`,
              type: "save",
              label: "Saved a social post",
              detail: text.length > 80 ? text.slice(0, 80) + "…" : text,
              time: row.savedAt ?? sp.createdAt ?? new Date().toISOString(),
              icon: "save",
            });
          });
        }

        if (savedPostsRes.status === "fulfilled") {
          const rows: any[] = savedPostsRes.value?.data?.content ?? [];
          rows.forEach((row) => {
            const p = row.post ?? row;
            const text = p.content ?? "Government post";
            items.push({
              id: `save-p-${p.id ?? row.id}`,
              type: "save",
              label: "Saved a government post",
              detail: text.length > 80 ? text.slice(0, 80) + "…" : text,
              time: row.savedAt ?? p.createdAt ?? new Date().toISOString(),
              icon: "save",
            });
          });
        }

        items.sort(
          (a, b) =>
            new Date(b.time).getTime() - new Date(a.time).getTime()
        );
        setActivity(items);
      })
      .finally(() => setLoadingActivity(false));
  }, [tab]);

  const displayedPosts =
    postFilter === "active"
      ? activePosts
      : postFilter === "resolved"
      ? resolvedPosts
      : allPosts;

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="rounded-xl border border-base-300 bg-base-200 p-4">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 rounded-full bg-primary flex items-center justify-center text-primary-content font-bold text-2xl">
            {avatarLetter}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="font-semibold text-lg">{username}</h1>
              <ShieldCheck size={16} className="text-primary" />
            </div>
            <p className="text-sm opacity-70">
              {memberSince ? `Member since ${memberSince}` : "Loading…"} •{" "}
              {location}
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard value={issueCount}     label="Issues"       />
        <StatCard value={socialCount}    label="Social Posts" />
        <StatCard value={communityCount} label="Communities"  />
      </div>

      {/* Tabs */}
      <ProfileTabs active={tab} onChange={setTab} />

      {/* Issues tab */}
      {tab === "posts" && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(["all", "active", "resolved"] as PostFilter[]).map((f) => (
              <button
                key={f}
                onClick={() => setPostFilter(f)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition ${
                  postFilter === f
                    ? "bg-primary text-primary-content border-primary"
                    : "border-base-300 hover:border-blue-400"
                }`}
              >
                {f === "active"   && <Clock size={11} />}
                {f === "resolved" && <CheckCircle size={11} />}
                {f === "all"      && <FileText size={11} />}
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {loadingPosts ? (
            <div className="py-10 text-center text-sm opacity-50">Loading…</div>
          ) : displayedPosts.length === 0 ? (
            <EmptyState
              title="No issues yet"
              description="Issue posts you create will appear here."
            />
          ) : (
            displayedPosts.map((p) => (
              <IssuePostCard key={p.id} post={p} currentUser={currentUser} onDelete={(id) => handleDelete('posts', id)} />
            ))
          )}
        </div>
      )}

      {/* Social Posts tab */}
      {tab === "social" && (
        <div className="space-y-3">
          {loadingSocial ? (
            <div className="py-10 text-center text-sm opacity-50">Loading…</div>
          ) : socialPosts.length === 0 ? (
            <EmptyState
              title="No social posts yet"
              description="Social posts you publish will appear here."
            />
          ) : (
            socialPosts.map((p) => (
              <SocialPostCard key={p.id} post={p} currentUser={currentUser} onDelete={(id) => handleDelete('social-posts', id)} />
            ))
          )}
        </div>
      )}

      {/* Activity tab */}
      {tab === "activity" && (
        <div className="space-y-2">
          {loadingActivity ? (
            <div className="py-10 text-center text-sm opacity-50">Loading…</div>
          ) : activity.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Posts you like, comment on, or save will appear here."
            />
          ) : (
            activity.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl bg-base-200 p-3"
              >
                <ActivityIcon type={item.icon} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium">{item.label}</p>
                  <p className="text-xs opacity-60 truncate mt-0.5">
                    {item.detail}
                  </p>
                </div>
                <span className="text-xs opacity-40 shrink-0">
                  {timeAgo(item.time)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default Profile;
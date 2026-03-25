import { useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  MessageSquare,
  Share2,
  Bookmark,
  BadgeCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Users,
  Globe,
  Building2,
  AlertCircle,
  BarChart2,
} from "lucide-react";
import { MdCheck } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import CommentSection from "./CommentSection";
import type { PostType } from "./CommentSection";

// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiPost(url: string, body: unknown): Promise<unknown> {
  const token = localStorage.getItem("authToken") ?? localStorage.getItem("token");
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json().catch(() => null);
}

async function recordShare(postType: "posts" | "social-posts", id: number) {
  const url = `${window.location.origin}/${postType}/${id}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copy link:", url);
  }
  apiPost(
    `/api/interactions/${postType}/${id}/share?shareType=LINK_COPY`,
    {}
  ).catch(() => {});
}

function useCopied() {
  const [copied, setCopied] = useState(false);
  function flash() {
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }
  return { copied, flash };
}

// ─── Types ────────────────────────────────────────────────────────────────────
export type PostVariant    = "issue" | "social" | "community" | "government" | "poll";
export type PostStatus     = "ACTIVE" | "RESOLVED" | "DELETED" | "FLAGGED";
export type BroadcastScope = "AREA" | "DISTRICT" | "STATE" | "COUNTRY";

export type CurrentUser = {
  id: number;
  role: "ROLE_USER" | "ROLE_DEPARTMENT" | "ROLE_ADMIN";
  taggedUsernames?: string[];
  username: string;
};

type BasePost = {
  id: number;
  content: string;
  timeAgo?: string;
  username: string;
  userDisplayName?: string;
  userProfileImage?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
};

export type IssuePost = BasePost & {
  variant: "issue";
  status: PostStatus;
  broadcastScope?: BroadcastScope;
  broadcastScopeDescription?: string;
  targetPincodes?: string[];
  isResolved: boolean;
  resolvedAt?: string;
  canBeResolved?: boolean;
  dislikeCount: number;
  viewCount: number;
  taggedUsernames: string[];
  imageName?: string;
  hasImage?: boolean;
  isLikedByCurrentUser?: boolean;
  isDislikedByCurrentUser?: boolean;
  isSaved?: boolean;
};

export type SocialPost = BasePost & {
  variant: "social";
  isSaved?: boolean;
  isSavedByCurrentUser?: boolean;
  hashtags?: string[];
  communityId?: null;
  isLikedByCurrentUser?: boolean;
};

export type CommunityPost = BasePost & {
  variant: "community";
  communityId: number;
  communityName: string;
  isSaved?: boolean;
  isSavedByCurrentUser?: boolean;
  hashtags?: string[];
  isLikedByCurrentUser?: boolean;
};

export type GovernmentPost = BasePost & {
  variant: "government";
  department: string;
  isSaved?: boolean;
  isSavedByCurrentUser?: boolean;
  broadcastScope?: BroadcastScope;
  broadcastScopeDescription?: string;
  isGovernmentBroadcast: true;
  isLikedByCurrentUser?: boolean;
};

export type PollOption = {
  id: number;
  optionText: string;
  voteCount: number;
  percentage: number;
};

export type PollPost = BasePost & {
  variant: "poll";
  pollId: number;
  question: string;
  options: PollOption[];
  totalVotes: number;
  allowMultipleVotes: boolean;
  isExpired: boolean;
  expiresAt?: string;
  timeLeft?: string;
  userHasVoted: boolean;
  votedOptionIds: number[];
  showResults: boolean;
  isSaved?: boolean;
  communityId?: number;
  communityName?: string;
  isLikedByCurrentUser?: boolean;
};

export type AnyPost =
  | IssuePost
  | SocialPost
  | CommunityPost
  | GovernmentPost
  | PollPost;

type PostCardProps = {
  post: AnyPost;
  currentUser?: CurrentUser;
  onLike?: (postId: number, liked: boolean) => void;
  onDislike?: (postId: number, disliked: boolean) => void;
  onSave?: (postId: number, saved: boolean) => void;
  onShare?: (postId: number) => void;
  onComment?: (postId: number) => void;
  onResolve?: (postId: number, isResolved: boolean, message: string) => void;
  onVote?: (pollId: number, optionIds: number[]) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function scopeIcon(scope?: BroadcastScope) {
  return scope === "STATE" || scope === "COUNTRY"
    ? <Globe size={11} />
    : <MapPin size={11} />;
}

function scopeLabel(scope?: BroadcastScope, desc?: string) {
  if (desc) return desc;
  const map: Record<string, string> = {
    AREA: "Area", DISTRICT: "District", STATE: "State", COUNTRY: "National",
  };
  return scope ? (map[scope] ?? "Local") : "Local";
}

function canUpdateResolution(
  post: IssuePost,
  currentUser?: CurrentUser
): boolean {
  if (!currentUser) return false;
  if (currentUser.role === "ROLE_ADMIN") return true;
  if (currentUser.role === "ROLE_DEPARTMENT")
    return post.taggedUsernames?.includes(currentUser.username) ?? false;
  return false;
}

// Issue posts   → /api/comments/post/{id}
// All others    → /api/comments/social-posts/{id}
function commentPostType(variant: PostVariant): PostType {
  return variant === "issue" ? "post" : "social-posts";
}

// ─── Shared ActionBtn ─────────────────────────────────────────────────────────
function ActionBtn({
  onClick,
  active = false,
  activeClass = "bg-blue-700/15 text-blue-700",
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
      className={`flex items-center gap-1 rounded-lg px-2 py-1 transition-colors disabled:opacity-40
        ${active ? activeClass : "opacity-70 hover:opacity-100"}`}
    >
      {children}
    </button>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PostStatus }) {
  if (status === "RESOLVED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
        <CheckCircle2 size={11} /> Resolved
      </span>
    );
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
        <Clock size={11} /> Active
      </span>
    );
  return null;
}

// ─── ScopePill ────────────────────────────────────────────────────────────────
function ScopePill({ scope, desc }: { scope?: BroadcastScope; desc?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-base-300 px-2 py-0.5 text-xs opacity-70">
      {scopeIcon(scope)}
      {scopeLabel(scope, desc)}
    </span>
  );
}

// ─── ResolveModal ─────────────────────────────────────────────────────────────
function ResolveModal({
  postId,
  isOpen,
  onClose,
  onConfirm,
}: {
  postId: number;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (msg: string) => void;
}) {
  const [msg, setMsg] = useState("");
  if (!isOpen) return null;
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-5 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="mb-1 flex items-center gap-2 text-base font-bold">
            <CheckCircle2 size={18} className="text-success" />
            Mark Issue Resolved
          </h3>
          <p className="mb-3 text-sm opacity-60">
            Provide an update message for the citizen who raised this issue.
          </p>
          <textarea
            className="textarea textarea-bordered w-full resize-none text-sm"
            rows={3}
            placeholder="e.g. Road repair completed on 15 Jan 2025…"
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <button className="btn btn-ghost btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn btn-success btn-sm"
              disabled={!msg.trim()}
              onClick={() => onConfirm(msg.trim())}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PollCard
// ═══════════════════════════════════════════════════════════════════════════════
function PollCard({
  post,
  currentUser,
  onVote,
  onShare,
  onSave,
}: {
  post: PollPost;
  currentUser?: CurrentUser;
  onVote?: (pollId: number, optionIds: number[]) => void;
  onShare?: (postId: number) => void;
  onSave?: (postId: number, saved: boolean) => void;
}) {
  const [selected, setSelected] = useState<number[]>(
    post.votedOptionIds ?? []
  );
  const [hasVoted, setHasVoted] = useState(post.userHasVoted);
  const [options, setOptions]   = useState<PollOption[]>(post.options);
  const [totalVotes, setTotalVotes] = useState(post.totalVotes);
  const [saved, setSaved]       = useState(post.isSaved ?? false);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const [voting, setVoting]     = useState(false);
  const { copied, flash }       = useCopied();

  const canVote     = !hasVoted && !post.isExpired && !!currentUser;
  const showResults = hasVoted || post.showResults || post.isExpired;

  function toggleOption(id: number) {
    if (!canVote) return;
    setSelected((prev) =>
      post.allowMultipleVotes
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : [id]
    );
  }

  async function submitVote() {
    if (!selected.length || voting) return;
    setVoting(true);
    try {
      await apiPost(`/api/polls/${post.pollId}/vote`, selected);
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
      onVote?.(post.pollId, selected);
    } catch {
      setSelected(post.votedOptionIds ?? []);
    } finally {
      setVoting(false);
    }
  }

  async function handleSave() {
    const next = !saved;
    setSaved(next);
    onSave?.(post.id, next);
    try {
      await apiPost(`/api/interactions/social-posts/${post.id}/save`, {});
    } catch {
      setSaved(!next);
    }
  }

  async function handleShare() {
    flash();
    setShareCount((n) => n + 1);
    onShare?.(post.id);
    await recordShare("social-posts", post.id);
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.15 }}
      className="rounded-xl border border-base-300 bg-base-200 p-4"
    >
      {/* Header */}
      <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {post.communityId && post.communityName && (
          <span className="flex items-center gap-1 rounded-full bg-blue-700/10 px-2 py-0.5 text-xs font-semibold text-blue-700">
            <Users size={11} /> {post.communityName}
          </span>
        )}
        <span className="font-medium opacity-80">
          {post.userDisplayName || post.username}
        </span>
        <span className="opacity-40">•</span>
        <span className="opacity-50">{post.timeAgo ?? "just now"}</span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-blue-700/10 px-2 py-0.5 text-xs font-semibold text-blue-700">
          <BarChart2 size={11} /> Poll
        </span>
      </div>

      <p className="mb-3 font-semibold">{post.question}</p>

      {/* Options */}
      <div className="space-y-2">
        {options.map((opt) => {
          const isSelected = selected.includes(opt.id);
          const isVotedFor = post.votedOptionIds?.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => toggleOption(opt.id)}
              disabled={!canVote}
              className={`relative w-full overflow-hidden rounded-lg border text-left transition-colors
                ${
                  isSelected && !hasVoted
                    ? "border-blue-700"
                    : isVotedFor
                    ? "border-blue-700/60"
                    : "border-base-300"
                }
                ${canVote ? "cursor-pointer hover:border-blue-700/50" : "cursor-default"}`}
            >
              {showResults && (
                <div
                  className={`absolute inset-y-0 left-0 transition-all duration-500
                    ${isVotedFor ? "bg-blue-700/25" : "bg-base-300/50"}`}
                  style={{ width: `${opt.percentage}%` }}
                />
              )}
              <div className="relative z-10 flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  {!hasVoted && canVote && (
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2
                        ${
                          isSelected
                            ? "border-blue-700 bg-blue-700"
                            : "border-base-content/30"
                        }`}
                    >
                      {isSelected && (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </span>
                  )}
                  {opt.optionText}
                </span>
                {showResults && (
                  <span
                    className={`font-semibold ${
                      isVotedFor ? "text-blue-700" : "opacity-70"
                    }`}
                  >
                    {opt.percentage}%
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {canVote && selected.length > 0 && (
        <button
          onClick={submitVote}
          disabled={voting}
          className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm mt-3 w-full"
        >
          {voting ? "Submitting…" : "Vote"}
        </button>
      )}

      <div className="mt-2 flex items-center gap-3 text-xs opacity-60">
        <span>{totalVotes.toLocaleString()} votes</span>
        {(post.timeLeft || post.isExpired) && (
          <span className="flex items-center gap-1">
            <Clock size={12} />
            {post.isExpired ? "Poll ended" : post.timeLeft}
          </span>
        )}
        {hasVoted && !post.isExpired && (
          <span className="text-success flex items-center gap-0.5">
            <MdCheck size={14} /> Voted
          </span>
        )}
      </div>

      {/* Action bar */}
      <div className="mt-2 flex items-center gap-1 text-sm flex-wrap">
        <ActionBtn
          onClick={handleSave}
          active={saved}
          activeClass="bg-accent/15 text-accent"
        >
          <Bookmark size={16} className={saved ? "fill-current" : ""} />
        </ActionBtn>
        <ActionBtn
          onClick={handleShare}
          active={copied}
          activeClass="text-success"
        >
          <Share2 size={16} />
          <span className={copied ? "" : "hidden sm:inline"}>
            {copied ? "Copied!" : shareCount > 0 ? String(shareCount) : "Share"}
          </span>
        </ActionBtn>
      </div>

      {/* Comment section */}
      <CommentSection
        postId={post.id}
        postType="social-posts"
        commentCount={post.commentCount}
        currentUsername={currentUser?.username}
        currentRole={currentUser?.role}
      />
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main PostCard
// ═══════════════════════════════════════════════════════════════════════════════
export default function PostCard({
  post,
  currentUser,
  onLike,
  onDislike,
  onSave,
  onShare,
  onComment,
  onResolve,
  onVote,
}: PostCardProps) {
  const [liked, setLiked] = useState(
    !!(post as AnyPost)?.isLikedByCurrentUser
  );
  const [disliked, setDisliked] = useState(
    !!(post as IssuePost)?.isDislikedByCurrentUser
  );
  const [saved, setSaved] = useState(
    !!(
      (post as SocialPost).isSaved ??
      (post as SocialPost).isSavedByCurrentUser ??
      false
    )
  );
  const [likeCount, setLikeCount]       = useState(post?.likeCount ?? 0);
  const [dislikeCount, setDislikeCount] = useState(
    (post as IssuePost)?.dislikeCount ?? 0
  );
  const [shareCount, setShareCount]     = useState(post?.shareCount ?? 0);

  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving]     = useState(false);
  const { copied, flash }             = useCopied();

  if (!post) return null;

  // Route polls to dedicated card
  if (post.variant === "poll") {
    return (
      <PollCard
        post={post as PollPost}
        currentUser={currentUser}
        onVote={onVote}
        onShare={onShare}
        onSave={onSave}
      />
    );
  }

  const isIssue     = post.variant === "issue";
  const isGovt      = post.variant === "government";
  const isCommunity = post.variant === "community";
  const isSocial    = post.variant === "social";
  const interactionType: "posts" | "social-posts" = isIssue
    ? "posts"
    : "social-posts";
  const isResolved =
    isIssue && (post as IssuePost).status === "RESOLVED";
  const govCanResolve =
    isIssue &&
    (post as IssuePost).status === "ACTIVE" &&
    canUpdateResolution(post as IssuePost, currentUser);
  const showStatusBadge =
    isIssue && canUpdateResolution(post as IssuePost, currentUser);

  // ── handlers ─────────────────────────────────────────────────────────────

  async function handleLike() {
    if (isResolved) return;
    const next = !liked;
    setLiked(next);
    if (next && disliked) {
      setDisliked(false);
      setDislikeCount((n) => Math.max(0, n - 1));
    }
    setLikeCount((n) => (next ? n + 1 : Math.max(0, n - 1)));
    onLike?.(post.id, next);
    const ep = isIssue
      ? `/api/posts/interactions/${post.id}/like`
      : `/api/social-posts/interactions/${post.id}/like`;
    try {
      await apiPost(ep, {});
    } catch {
      setLiked(!next);
      setLikeCount((n) => (next ? Math.max(0, n - 1) : n + 1));
    }
  }

  async function handleDislike() {
    if (!isIssue || isResolved) return;
    const next = !disliked;
    setDisliked(next);
    if (next && liked) {
      setLiked(false);
      setLikeCount((n) => Math.max(0, n - 1));
    }
    setDislikeCount((n) => (next ? n + 1 : Math.max(0, n - 1)));
    onDislike?.(post.id, next);
    try {
      await apiPost(`/api/interactions/posts/${post.id}/dislike`, {});
    } catch {
      setDisliked(!next);
      setDislikeCount((n) => (next ? Math.max(0, n - 1) : n + 1));
    }
  }

  async function handleSave() {
    const next = !saved;
    setSaved(next);
    onSave?.(post.id, next);
    try {
      await apiPost(
        `/api/interactions/${interactionType}/${post.id}/save`,
        {}
      );
    } catch {
      setSaved(!next);
    }
  }

  async function handleShare() {
    flash();
    setShareCount((n) => n + 1);
    onShare?.(post.id);
    await recordShare(interactionType, post.id);
  }

  async function handleResolveConfirm(message: string) {
    setResolving(true);
    try {
      await apiPost(
        `/api/posts/${post.id}/resolution?isResolved=true&updateMessage=${encodeURIComponent(
          message
        )}`,
        {}
      );
      setResolveOpen(false);
      onResolve?.(post.id, true, message);
    } catch {
      // keep modal open
    } finally {
      setResolving(false);
    }
  }

  const containerClass = isGovt
    ? "overflow-hidden rounded-2xl border border-info/30 bg-info/5 transition-all duration-200"
    : isResolved
    ? "overflow-hidden rounded-2xl border border-success/25 bg-success/5 transition-all duration-200"
    : "overflow-hidden rounded-2xl border border-base-300 bg-base-200 transition-all duration-200";

  const hasMedia = ("mediaUrls" in post && post.mediaUrls && (post.mediaUrls as string[]).length > 0) || 
                   ("imageName" in post && typeof post.imageName === "string" && post.imageName.length > 0);

  const imageUrl = ("mediaUrls" in post && post.mediaUrls && (post.mediaUrls as string[]).length > 0)
    ? (post.mediaUrls as string[])[0]
    : ("imageName" in post && typeof post.imageName === "string" && post.imageName.length > 0)
    ? (post.imageName.startsWith("http") ? post.imageName : `/uploads/posts/${post.imageName}`)
    : null;

  return (
    <>
      <motion.div
        whileHover={{ y: -4 }}
        transition={{ duration: 0.2 }}
        className={`${containerClass} flex flex-col shadow-sm hover:shadow-md`}
      >
        {/* Top 50% - Media */}
        {hasMedia && imageUrl && (
          <div className="relative h-64 sm:h-72 w-full overflow-hidden shrink-0 border-b border-base-300/50">
            <img
              src={imageUrl}
              alt="Post content"
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
          </div>
        )}

        {/* Bottom 50% - Details */}
        <div className="flex flex-1 flex-col p-5">
        {/* Header */}
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {isGovt && (
            <span className="flex items-center gap-1 font-semibold text-info">
              <BadgeCheck size={16} />
              {(post as GovernmentPost).department}
            </span>
          )}
          {isCommunity && (
            <span className="flex items-center gap-1 rounded-full bg-blue-700/10 px-2 py-0.5 text-xs font-semibold text-blue-700">
              <Users size={11} />
              {(post as CommunityPost).communityName}
            </span>
          )}
          {!isGovt && (
            <span className="font-medium opacity-80">
              {post.userDisplayName || post.username}
            </span>
          )}
          <span className="opacity-40">•</span>
          <span className="opacity-50">{post.timeAgo ?? "just now"}</span>
          {(isIssue || isGovt) && (
            <>
              <span className="opacity-40">•</span>
              <ScopePill
                scope={
                  "broadcastScope" in post
                    ? (post as IssuePost | GovernmentPost).broadcastScope
                    : undefined
                }
                desc={
                  "broadcastScopeDescription" in post
                    ? (post as IssuePost | GovernmentPost)
                        .broadcastScopeDescription
                    : undefined
                }
              />
            </>
          )}
          {showStatusBadge && (
            <span className="ml-auto">
              <StatusBadge status={(post as IssuePost).status} />
            </span>
          )}
        </div>

        {/* Resolve banner */}
        {govCanResolve && !resolving && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs">
            <span className="flex items-center gap-1.5 text-warning">
              <AlertCircle size={13} />
              This issue is assigned to your department
            </span>
            <button
              onClick={() => setResolveOpen(true)}
              className="btn btn-success btn-xs"
            >
              <CheckCircle2 size={12} /> Mark Resolved
            </button>
          </div>
        )}

        {/* Resolved notice */}
        {isResolved && (
          <div className="mb-3 flex items-center gap-1.5 rounded-lg bg-success/15 px-3 py-2 text-xs font-medium text-success">
            <CheckCircle2 size={13} />
            Issue resolved
            {(post as IssuePost).resolvedAt && (
              <span className="opacity-70">
                · {(post as IssuePost).resolvedAt}
              </span>
            )}
          </div>
        )}

        {/* Content */}
        <p className="mb-3 text-sm leading-relaxed">{post.content}</p>


        {/* Tagged depts */}
        {isIssue && (post as IssuePost).taggedUsernames?.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {(post as IssuePost).taggedUsernames.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1 rounded-full border border-info/30 bg-info/10 px-2 py-0.5 text-xs text-info"
              >
                <Building2 size={10} /> @{name}
              </span>
            ))}
          </div>
        )}

        {/* Hashtags */}
        {(isSocial || isCommunity) &&
          "hashtags" in post &&
          (post as SocialPost | CommunityPost).hashtags?.map((tag) => (
            <span
              key={tag}
              className="mr-1.5 inline-block text-xs font-medium text-blue-700 opacity-80"
            >
              {tag}
            </span>
          ))}

        {/* ── Action bar ── */}
        <div className="mt-3 flex items-center gap-1 text-sm flex-wrap">
          {/* Like */}
          <ActionBtn onClick={handleLike} active={liked} disabled={isResolved}>
            <ArrowUp size={16} />
            <span>{likeCount}</span>
          </ActionBtn>

          {/* Dislike — issues only */}
          {isIssue && (
            <ActionBtn
              onClick={handleDislike}
              active={disliked}
              activeClass="bg-error/15 text-error"
              disabled={isResolved}
            >
              <ArrowDown size={16} />
              <span>{dislikeCount}</span>
            </ActionBtn>
          )}

          {/* Comment count badge */}
          <ActionBtn onClick={() => onComment?.(post.id)}>
            <MessageSquare size={16} />
            <span>{post.commentCount}</span>
          </ActionBtn>

          {/* Save — NOT shown for issue posts (backend rule) */}
          {!isIssue && (
            <ActionBtn
              onClick={handleSave}
              active={saved}
              activeClass="bg-accent/15 text-accent"
            >
              <Bookmark size={16} className={saved ? "fill-current" : ""} />
            </ActionBtn>
          )}

          {/* Share */}
          <ActionBtn
            onClick={handleShare}
            active={copied}
            activeClass="text-success"
          >
            <Share2 size={16} />
            <span className={copied ? "" : "hidden sm:inline"}>
              {copied
                ? "Copied!"
                : shareCount > 0
                ? String(shareCount)
                : "Share"}
            </span>
          </ActionBtn>
        </div>

        {/* ── Comment Section ── */}
        {/* Issue → /api/comments/post/{id}          */}
        {/* Others → /api/comments/social-posts/{id} */}
        {/* Resolved issue posts cannot receive new comments */}
        {isIssue && isResolved ? (
          <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-base-300/50 px-3 py-2 text-xs opacity-50">
            <MessageSquare size={12} />
            Comments are closed — this issue has been resolved.
          </div>
        ) : (
          <CommentSection
            postId={post.id}
            postType={commentPostType(post.variant)}
            commentCount={post.commentCount}
            currentUsername={currentUser?.username}
            currentRole={currentUser?.role}
          />
        )}
        </div>
      </motion.div>

      <ResolveModal
        postId={post.id}
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onConfirm={handleResolveConfirm}
      />
    </>
  );
}
import { useState, useEffect } from "react";
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
  Trash2,
  ChevronLeft,
  ChevronRight,
  X,
  ImageIcon,
  UserPlus,
} from "lucide-react";
import { MdCheck } from "react-icons/md";
import { motion, AnimatePresence } from "framer-motion";
import CommentSection from "./CommentSection";
import type { PostType } from "./CommentSection";
import { resolveMediaUrl } from "../../utils/postUtils";

// ─── API helpers ──────────────────────────────────────────────────────────────
// ─── API helpers ──────────────────────────────────────────────────────────────
async function apiFetch(url: string, method: string, body?: unknown): Promise<unknown> {
  const token = localStorage.getItem("authToken") ?? localStorage.getItem("token");
  const res = await fetch(url, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (res.status === 204) return null;
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json().catch(() => null);
}

const apiPost = (url: string, body: unknown) => apiFetch(url, "POST", body);
const apiPut = (url: string, body?: unknown) => apiFetch(url, "PUT", body);

async function recordShare(postType: "posts" | "social-posts", id: number) {
  const url = `${window.location.origin}/${postType}/${id}`;
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    window.prompt("Copy link:", url);
  }
  apiPost(`/api/interactions/${postType}/${id}/share?shareType=LINK_COPY`, {}).catch(() => {});
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
export type PostVariant = "issue" | "social" | "community" | "government" | "poll";
export type PostStatus = "ACTIVE" | "RESOLVED" | "DELETED" | "FLAGGED";
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
  mediaUrls?: string[];
  communityId?: number | null;
  isLikedByCurrentUser?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
  isPoll?: boolean;
  pollId?: number;
};

export type CommunityPost = BasePost & {
  variant: "community";
  communityId: number;
  communityName: string;
  communityAvatar?: string;
  communityMemberCount?: string;
  isMember?: boolean;
  authorRole?: string;
  isSaved?: boolean;
  isSavedByCurrentUser?: boolean;
  hashtags?: string[];
  mediaUrls?: string[];
  isLikedByCurrentUser?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
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
  communityAvatar?: string;
  communityMemberCount?: string;
  isMember?: boolean;
  authorRole?: string;
  isLikedByCurrentUser?: boolean;
  canEdit?: boolean;
  canDelete?: boolean;
};

export type AnyPost = IssuePost | SocialPost | CommunityPost | GovernmentPost | PollPost;

type PostCardProps = {
  post: AnyPost;
  currentUser?: CurrentUser;
  onLike?: (postId: number, liked: boolean) => void;
  onSave?: (postId: number, saved: boolean) => void;
  onShare?: (postId: number) => void;
  onComment?: (postId: number) => void;
  onResolve?: (postId: number, isResolved: boolean, message: string) => void;
  onVote?: (pollId: number, optionIds: number[]) => void;
  onDelete?: (postId: number) => void;
  hideCommunityStrip?: boolean;
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

/**
 * "Mark Resolved" is only shown to:
 *  - ROLE_ADMIN: can resolve any issue
 *  - ROLE_DEPARTMENT: only if their username appears in post.taggedUsernames
 *    (i.e., the issue is actively assigned to their department)
 */
function canUpdateResolution(post: IssuePost, currentUser?: CurrentUser): boolean {
  if (!currentUser) return false;
  if (currentUser.role === "ROLE_ADMIN") return true;
  if (currentUser.role === "ROLE_DEPARTMENT")
    return post.taggedUsernames?.includes(currentUser.username) ?? false;
  return false;
}

function commentPostType(variant: PostVariant): PostType {
  return variant === "issue" ? "post" : "social-posts";
}

// ─── Determine if a post belongs to a community ───────────────────────────────
function isCommunityPost(post: AnyPost): boolean {
  if (post.variant === "community") return true;
  if (post.variant === "poll" && !!(post as PollPost).communityId) return true;
  if ((post.variant === "social") && !!(post as SocialPost).communityId) return true;
  return false;
}

function getCommunityId(post: AnyPost): number | null {
  if (post.variant === "community") return (post as CommunityPost).communityId;
  if (post.variant === "poll") return (post as PollPost).communityId ?? null;
  if (post.variant === "social") return (post as SocialPost).communityId ?? null;
  return null;
}

// ─── JoinButton – shown only when post is from a community ───────────────────
function JoinButton({
  isJoined,
  onClick,
  size = "md",
}: {
  isJoined: boolean;
  onClick: (e: React.MouseEvent) => void;
  size?: "sm" | "md";
}) {
  const base =
    "inline-flex items-center gap-1.5 font-semibold rounded-full border transition-all duration-200 select-none cursor-pointer";
  const sizes =
    size === "sm"
      ? "text-[11px] px-3 py-1"
      : "text-xs px-4 py-1.5";

  if (isJoined) {
    return (
      <button
        onClick={onClick}
        className={`${base} ${sizes} border-base-content/20 bg-transparent text-base-content/60 hover:border-error/40 hover:text-error hover:bg-error/5`}
      >
        <CheckCircle2 size={12} />
        Joined
      </button>
    );
  }
  return (
    <button
      onClick={onClick}
      className={`${base} ${sizes} border-[#1D4ED8] bg-[#1D4ED8] text-white hover:bg-[#1e40af] hover:border-[#1e40af] shadow-sm`}
    >
      <UserPlus size={12} />
      Join
    </button>
  );
}

// ─── Community strip at top of card ──────────────────────────────────────────
function CommunityStrip({
  post,
  isJoined,
  onJoin,
}: {
  post: AnyPost;
  isJoined: boolean;
  onJoin: (cid: number) => void;
}) {
  const communityId = getCommunityId(post);
  const communityName =
    (post as CommunityPost).communityName ||
    (post as PollPost).communityName ||
    "Community";
  const communityAvatar =
    (post as CommunityPost).communityAvatar ||
    (post as PollPost).communityAvatar;
  const memberCount =
    (post as CommunityPost).communityMemberCount ||
    (post as PollPost).communityMemberCount;

  return (
    <div className="flex items-center justify-between gap-3 pb-3 mb-1 border-b border-base-content/8">
      <div className="flex items-center gap-2.5 min-w-0">
        {communityAvatar ? (
          <img
            src={communityAvatar}
            className="w-9 h-9 rounded-xl object-cover shrink-0 ring-1 ring-base-content/10"
            alt=""
          />
        ) : (
          <div className="w-9 h-9 rounded-xl bg-[#1D4ED8]/10 flex items-center justify-center shrink-0">
            <Users size={16} className="text-[#1D4ED8]" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-bold leading-tight truncate">{communityName}</p>
          {memberCount && (
            <p className="text-[11px] text-base-content/50 mt-0.5">{memberCount} members</p>
          )}
        </div>
      </div>
      {communityId && (
        <JoinButton
          isJoined={isJoined}
          onClick={(e) => {
            e.stopPropagation();
            onJoin(communityId);
          }}
          size="sm"
        />
      )}
    </div>
  );
}

// ─── Author row ───────────────────────────────────────────────────────────────
function AuthorRow({
  post,
  badge,
  onDelete,
  isDeleting,
  showDelete,
}: {
  post: AnyPost;
  badge?: string;
  onDelete?: () => void;
  isDeleting?: boolean;
  showDelete?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      {post.userProfileImage ? (
        <img
          src={post.userProfileImage}
          className="w-8 h-8 rounded-full object-cover shrink-0"
          alt=""
        />
      ) : (
        <img
          src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(post.username || "?")}`}
          className="w-8 h-8 rounded-full object-cover shrink-0 bg-base-300"
          alt="Avatar"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-sm font-semibold leading-tight truncate">
            {post.userDisplayName || post.username}
          </span>
          {badge && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[#1D4ED8]/10 text-[#1D4ED8]">
              {badge}
            </span>
          )}
        </div>
        <p className="text-[11px] text-base-content/40 mt-0.5">{post.timeAgo ?? "just now"}</p>
      </div>
      {showDelete && onDelete && (
        <button
          onClick={onDelete}
          disabled={isDeleting}
          className="p-1.5 text-base-content/30 hover:text-error hover:bg-error/8 rounded-lg transition-colors disabled:opacity-40"
        >
          <Trash2 size={14} />
        </button>
      )}
    </div>
  );
}

// ─── ScopePill ────────────────────────────────────────────────────────────────
function ScopePill({ scope, desc }: { scope?: BroadcastScope; desc?: string }) {
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-base-300 px-2 py-0.5 text-[11px] opacity-60">
      {scopeIcon(scope)}
      {scopeLabel(scope, desc)}
    </span>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: PostStatus }) {
  if (status === "RESOLVED")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
        <CheckCircle2 size={11} /> Resolved
      </span>
    );
  if (status === "ACTIVE")
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-semibold text-warning">
        <Clock size={11} /> Active
      </span>
    );
  return null;
}

// ─── ResolveModal ─────────────────────────────────────────────────────────────
function ResolveModal({
  isOpen,
  onClose,
  onConfirm,
}: {
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
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
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

// ─── Action pill button ───────────────────────────────────────────────────────
function ActionPill({
  onClick,
  active = false,
  activeClass = "bg-[#1D4ED8]/10 text-[#1D4ED8]",
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
      className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-all disabled:opacity-40
        ${active ? activeClass : "text-base-content/60 hover:bg-base-content/6 hover:text-base-content"}`}
    >
      {children}
    </button>
  );
}

// ─── Join banner (for non-member community viewers) ───────────────────────────
function JoinPromptBanner({
  communityName,
  onJoin,
}: {
  communityName: string;
  onJoin: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mt-3 rounded-xl bg-[#1D4ED8]/6 border border-[#1D4ED8]/15 px-4 py-3">
      <p className="text-xs text-base-content/70 leading-relaxed">
        Join <span className="font-semibold text-base-content">{communityName}</span> to comment and interact with posts.
      </p>
      <button
        onClick={onJoin}
        className="shrink-0 text-xs font-bold px-4 py-1.5 rounded-full bg-[#1D4ED8] text-white hover:bg-[#1e40af] transition-colors"
      >
        Join
      </button>
    </div>
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
  onDelete,
}: {
  post: PollPost;
  currentUser?: CurrentUser;
  onVote?: (pollId: number, optionIds: number[]) => void;
  onShare?: (postId: number) => void;
  onSave?: (postId: number, saved: boolean) => void;
  onDelete?: (postId: number) => void;
}) {
  const [selected, setSelected] = useState<number[]>(post.votedOptionIds ?? []);
  const [hasVoted, setHasVoted] = useState(post.userHasVoted ?? false);
  const [options, setOptions] = useState<PollOption[]>(post.options ?? []);
  const [totalVotes, setTotalVotes] = useState(post.totalVotes ?? 0);
  const [saved, setSaved] = useState(post.isSaved ?? false);
  const [shareCount, setShareCount] = useState(post.shareCount ?? 0);
  const [voting, setVoting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJoined, setIsJoined] = useState(post.isMember ?? false);
  const { copied, flash } = useCopied();
  const [commentsOpen, setCommentsOpen] = useState(false);

  const hasCommunity = !!post.communityId;
  const isLoggedIn = !!currentUser || !!(localStorage.getItem("authToken") || localStorage.getItem("token"));
  const canVote = !hasVoted && !post.isExpired && isLoggedIn;
  const showResults = hasVoted || post.isExpired;

  function toggleOption(id: number) {
    if (!canVote) return;
    setSelected((prev) =>
      post.allowMultipleVotes
        ? prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
      setOptions(newOpts.map((o) => ({
        ...o,
        percentage: newTotal > 0 ? Math.round((o.voteCount / newTotal) * 100) : 0,
      })));
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

  async function handleJoinCommunity(cid: number) {
    const next = !isJoined;
    setIsJoined(next);
    try {
      await apiPost(`/api/communities/${cid}/join`, {});
    } catch {
      setIsJoined(!next);
      alert("Could not join community.");
    }
  }

  async function handleDelete() {
    if (onDelete) { onDelete(post.id); return; }
    if (!window.confirm("Delete this poll?")) return;
    setIsDeleting(true);
    try {
      await fetch(`/api/polls/${post.pollId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || localStorage.getItem("token")}` },
      });
      window.location.reload();
    } catch {
      alert("Failed to delete poll");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="rounded-2xl border border-base-300 bg-base-100 shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col"
    >
      <div className="p-4 sm:p-5 flex flex-col gap-3 flex-1">
        {/* Community strip — only if community post */}
        {hasCommunity && (
          <CommunityStrip
            post={post}
            isJoined={isJoined}
            onJoin={handleJoinCommunity}
          />
        )}

        {/* Author + poll badge */}
        <div className="flex items-center justify-between gap-2">
          <AuthorRow
            post={post}
            badge={(post as any).authorRole}
            onDelete={handleDelete}
            isDeleting={isDeleting}
            showDelete={post.canDelete}
          />
          <span className="inline-flex items-center gap-1 rounded-full bg-[#1D4ED8]/10 px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] shrink-0">
            <BarChart2 size={11} /> Poll
          </span>
        </div>

        {/* Question */}
        <p className="font-semibold text-sm leading-snug">{post.question}</p>

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
                className={`relative w-full overflow-hidden rounded-xl border text-left transition-all
                  ${isSelected && !hasVoted ? "border-[#1D4ED8] ring-1 ring-[#1D4ED8]/25" : isVotedFor ? "border-[#1D4ED8]/50" : "border-base-300"}
                  ${canVote ? "cursor-pointer hover:border-[#1D4ED8]/50 hover:bg-base-200/50" : "cursor-default"}`}
              >
                {showResults && (
                  <div
                    className={`absolute inset-y-0 left-0 transition-all duration-500 ${isVotedFor ? "bg-[#1D4ED8]/15" : "bg-base-300/50"}`}
                    style={{ width: `${opt.percentage}%` }}
                  />
                )}
                <div className="relative z-10 flex items-center justify-between px-3 py-2.5 text-sm">
                  <span className="flex items-center gap-2">
                    {!hasVoted && canVote && (
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${isSelected ? "border-[#1D4ED8] bg-[#1D4ED8]" : "border-base-content/30"}`}>
                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                    )}
                    {hasVoted && isVotedFor && <MdCheck size={16} className="text-[#1D4ED8] shrink-0" />}
                    {opt.optionText}
                  </span>
                  {showResults && (
                    <span className={`font-semibold text-xs ${isVotedFor ? "text-[#1D4ED8]" : "opacity-60"}`}>
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
            className="btn bg-[#1D4ED8] text-white font-semibold border-none hover:bg-[#1e40af] btn-sm w-full rounded-xl"
          >
            {voting ? "Submitting…" : "Vote"}
          </button>
        )}

        <div className="flex items-center gap-3 text-[11px] text-base-content/50">
          <span>{totalVotes.toLocaleString()} votes</span>
          {(post.timeLeft || post.isExpired) && (
            <span className="flex items-center gap-1">
              <Clock size={11} />
              {post.isExpired ? "Poll ended" : post.timeLeft}
            </span>
          )}
          {hasVoted && !post.isExpired && (
            <span className="text-success flex items-center gap-0.5">
              <MdCheck size={13} /> Voted
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 border-t border-base-content/8 pt-3 mt-1">
          <ActionPill onClick={handleSave} active={saved} activeClass="bg-amber-500/10 text-amber-600">
            <Bookmark size={16} className={saved ? "fill-current" : ""} />
            <span className="text-xs">Save</span>
          </ActionPill>
          <ActionPill onClick={handleShare} active={copied} activeClass="text-success">
            <Share2 size={16} />
            <span className="text-xs">{copied ? "Copied!" : shareCount > 0 ? shareCount : "Share"}</span>
          </ActionPill>
          <ActionPill onClick={() => setCommentsOpen(!commentsOpen)}>
            <MessageSquare size={16} />
            <span className="text-xs">{post.commentCount > 0 ? post.commentCount : "Comment"}</span>
          </ActionPill>
        </div>

        {commentsOpen && (
          <CommentSection
            postId={post.id}
            postType="social-posts"
            commentCount={post.commentCount}
            currentUsername={currentUser?.username}
            currentRole={currentUser?.role}
            defaultOpen={true}
          />
        )}

        {/* Join prompt banner — only when community & not yet joined */}
        {hasCommunity && !isJoined && (
          <JoinPromptBanner
            communityName={(post as PollPost).communityName || "this community"}
            onJoin={(e) => { e.stopPropagation(); handleJoinCommunity(post.communityId!); }}
          />
        )}
      </div>
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
  onSave,
  onShare,
  onResolve,
  onVote,
  onDelete,
  hideCommunityStrip,
}: PostCardProps) {

  const [liked, setLiked] = useState(!!(post as AnyPost)?.isLikedByCurrentUser);
  const [disliked, setDisliked] = useState(!!(post as IssuePost)?.isDislikedByCurrentUser);
  const [saved, setSaved] = useState(
    !!((post as any).isSavedByCurrentUser ?? (post as any).isSaved ?? (post as any).saved ?? false)
  );
  const [likeCount, setLikeCount] = useState(post?.likeCount ?? 0);
  const [dislikeCount, setDislikeCount] = useState((post as IssuePost)?.dislikeCount ?? 0);
  const [shareCount, setShareCount] = useState(post?.shareCount ?? 0);
  const [resolveOpen, setResolveOpen] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isJoined, setIsJoined] = useState((post as CommunityPost).isMember ?? false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState<Record<number, boolean>>({});
  const { copied, flash } = useCopied();

  useEffect(() => {
    if (post) {
      setLiked(!!(post as AnyPost)?.isLikedByCurrentUser);
      setLikeCount(post.likeCount ?? 0);
      setShareCount(post.shareCount ?? 0);
      setSaved(!!((post as any).isSavedByCurrentUser ?? (post as any).saved ?? false));
      if ("dislikeCount" in post) setDislikeCount((post as IssuePost).dislikeCount ?? 0);
      if ("isDislikedByCurrentUser" in post) setDisliked(!!(post as IssuePost).isDislikedByCurrentUser);
    }
  }, [post]);

  if (!post) return null;

  if (post.variant === "poll") {
    return (
      <PollCard
        post={post as PollPost}
        currentUser={currentUser}
        onVote={onVote}
        onShare={onShare}
        onSave={onSave}
        onDelete={onDelete}
      />
    );
  }

  const isIssue = post.variant === "issue";
  const isGovt = post.variant === "government";
  const isCommunity = post.variant === "community";
  const isSocial = post.variant === "social";
  const interactionType: "posts" | "social-posts" = isIssue ? "posts" : "social-posts";
  const isResolved = isIssue && (post as IssuePost).status === "RESOLVED";

  /**
   * govCanResolve: show "Mark Resolved" button ONLY when:
   *  1. It's an issue post
   *  2. The issue is still ACTIVE (not resolved)
   *  3. The current user is an ADMIN, OR is a DEPARTMENT user whose username
   *     is in post.taggedUsernames (the department this post is assigned to)
   */
  const govCanResolve =
    isIssue &&
    (post as IssuePost).status === "ACTIVE" &&
    canUpdateResolution(post as IssuePost, currentUser);

  const showStatusBadge = isIssue && canUpdateResolution(post as IssuePost, currentUser);

  // Community context
  const postHasCommunity = isCommunityPost(post);
  const communityId = getCommunityId(post);

  // Media — simplify URL resolution using refined utility
  const allMediaUrls: string[] = (() => {
    const urls: string[] = [];
    if ("mediaUrls" in post && Array.isArray(post.mediaUrls)) {
      (post.mediaUrls as string[]).filter(Boolean).forEach((u) => {
        urls.push(resolveMediaUrl(u, "social-posts"));
      });
    }
    if (urls.length === 0 && "imageName" in post && typeof post.imageName === "string" && post.imageName.length > 0) {
      urls.push(resolveMediaUrl(post.imageName, "posts"));
    }
    return urls;
  })();
  const hasMedia = allMediaUrls.length > 0;
  const isVideoUrl = (url: string) => /\.(mp4|webm|ogg|mov|avi|mkv)$/i.test(url);

  function prevImage(e?: React.MouseEvent) {
    e?.stopPropagation();
    setActiveImageIndex((i) => (i > 0 ? i - 1 : allMediaUrls.length - 1));
  }
  function nextImage(e?: React.MouseEvent) {
    e?.stopPropagation();
    setActiveImageIndex((i) => (i < allMediaUrls.length - 1 ? i + 1 : 0));
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  async function handleLike() {
    if (isResolved) return;
    const next = !liked;
    setLiked(next);
    if (next && disliked) { setDisliked(false); setDislikeCount((n) => Math.max(0, n - 1)); }
    setLikeCount((n) => (next ? n + 1 : Math.max(0, n - 1)));
    onLike?.(post.id, next);
    const ep = `/api/interactions/${interactionType}/${post.id}/like`;
    try {
      const res = await apiPost(ep, {});
      const data = (res as any)?.data ?? res;
      if (data && typeof data.liked === "boolean") setLiked(data.liked);
      if (data && typeof data.likeCount === "number") setLikeCount(data.likeCount);
    } catch {
      setLiked(!next);
      setLikeCount((n) => (next ? Math.max(0, n - 1) : n + 1));
    }
  }

  async function handleDislike() {
    if (!isIssue || isResolved) return;
    alert("Dislike feature coming soon!");
  }

  async function handleSave() {
    const next = !saved;
    setSaved(next);
    onSave?.(post.id, next);
    try {
      const res = await apiPost(`/api/interactions/${interactionType}/${post.id}/save`, {});
      const data = (res as any)?.data ?? res;
      if (data && typeof data.saved === "boolean") setSaved(data.saved);
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
      await apiPut(
        `/api/posts/${post.id}/resolution?isResolved=true&updateMessage=${encodeURIComponent(
          message
        )}`
      );
      setResolveOpen(false);
      onResolve?.(post.id, true, message);
    } catch (err) {
      console.error("Resolve error:", err);
    } finally {
      setResolving(false);
    }
  }

  async function handleDelete() {
    if (onDelete) { onDelete(post.id); return; }
    if (!window.confirm("Delete this post?")) return;
    setIsDeleting(true);
    try {
      const ep = isIssue ? `/api/posts/${post.id}` : `/api/social-posts/${post.id}`;
      await fetch(ep, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken") || localStorage.getItem("token")}` },
      });
      window.location.reload();
    } catch {
      alert("Failed to delete post");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleJoinCommunity(cid: number) {
    const next = !isJoined;
    setIsJoined(next);
    try {
      await apiPost(`/api/communities/${cid}/join`, {});
    } catch {
      setIsJoined(!next);
      alert("Could not join community.");
    }
  }

  // Card border styling
  const borderClass = isGovt
    ? "border-info/25 bg-info/3"
    : isResolved
    ? "border-success/25 bg-success/3"
    : "border-base-300 bg-base-100";

  return (
    <>
      <motion.div
        whileHover={{ y: -2 }}
        transition={{ duration: 0.18 }}
        className={`rounded-2xl border ${borderClass} shadow-sm hover:shadow-md transition-shadow duration-200 overflow-hidden flex flex-col`}
      >
        <div className="p-4 sm:p-5 flex flex-col gap-3">

          {/* ── Community strip — ONLY for community posts & if not hidden ── */}
          {postHasCommunity && communityId && !hideCommunityStrip && (
            <CommunityStrip
              post={post}
              isJoined={isJoined}
              onJoin={handleJoinCommunity}
            />
          )}


          {/* ── Author row ── */}
          {isGovt ? (
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-info/15 flex items-center justify-center shrink-0">
                <BadgeCheck size={16} className="text-info" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-info">{(post as GovernmentPost).department}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[11px] text-base-content/40">{post.timeAgo ?? "just now"}</span>
                  <ScopePill
                    scope={(post as GovernmentPost).broadcastScope}
                    desc={(post as GovernmentPost).broadcastScopeDescription}
                  />
                </div>
              </div>
            </div>
          ) : (
            <AuthorRow
              post={post}
              badge={(isCommunity ? (post as CommunityPost).authorRole : undefined)}
              onDelete={handleDelete}
              isDeleting={isDeleting}
              showDelete={!!(post as any).canDelete}
            />
          )}

          {/* ── Meta row: scope, status (issue posts only) ── */}
          {isIssue && (
            <div className="flex flex-wrap items-center gap-1.5 -mt-1">
              <ScopePill
                scope={"broadcastScope" in post ? (post as IssuePost).broadcastScope : undefined}
                desc={"broadcastScopeDescription" in post ? (post as IssuePost).broadcastScopeDescription : undefined}
              />
              {showStatusBadge && <StatusBadge status={(post as IssuePost).status} />}
            </div>
          )}

          {/* ── Mark Resolved banner — only when this dept is tagged & issue is ACTIVE ── */}
          {govCanResolve && !resolving && (
            <div className="flex items-center justify-between gap-2 rounded-xl border border-warning/25 bg-warning/8 px-3 py-2.5 text-xs">
              <span className="flex items-center gap-1.5 text-warning font-medium">
                <AlertCircle size={13} />
                Assigned to your department
              </span>
              <button onClick={() => setResolveOpen(true)} className="btn btn-success btn-xs rounded-lg">
                <CheckCircle2 size={12} /> Mark Resolved
              </button>
            </div>
          )}

          {isResolved && (
            <div className="flex items-center gap-1.5 rounded-xl bg-success/10 px-3 py-2 text-xs font-medium text-success">
              <CheckCircle2 size={13} />
              Issue resolved
              {(post as IssuePost).resolvedAt && (
                <span className="opacity-70">· {(post as IssuePost).resolvedAt}</span>
              )}
            </div>
          )}

          {/* ── Content ── */}
          <div>
            <p className={`text-sm leading-relaxed whitespace-pre-wrap ${!expanded ? "line-clamp-3" : ""}`}>
              {post.content}
            </p>
            {(post.content?.length ?? 0) > 160 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="mt-1 text-xs font-semibold text-[#1D4ED8]/70 hover:text-[#1D4ED8] transition-colors"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>

          {/* ── Hashtags / Tagged depts ── */}
          {((isIssue && ((post as IssuePost).taggedUsernames?.length ?? 0) > 0) ||
            ((isSocial || isCommunity) && "hashtags" in post && ((post as SocialPost).hashtags?.length ?? 0) > 0)) && (
            <div className="flex flex-wrap gap-1.5">
              {isIssue &&
                (post as IssuePost).taggedUsernames?.map((name) => (
                  <span
                    key={name}
                    className="inline-flex items-center gap-1 rounded-full border border-info/25 bg-info/8 px-2 py-0.5 text-[11px] text-info"
                  >
                    <Building2 size={10} /> @{name}
                  </span>
                ))}
              {(isSocial || isCommunity) &&
                "hashtags" in post &&
                (post as SocialPost).hashtags?.map((tag) => (
                  <span key={tag} className="text-xs font-medium text-[#1D4ED8]/75">
                    {tag}
                  </span>
                ))}
            </div>
          )}

          {/* ── Media ── */}
          {hasMedia && (
            <div className="relative overflow-hidden rounded-2xl border border-base-content/8 -mx-1">
              <div
                className="relative h-56 sm:h-72 cursor-pointer"
                onClick={() => setLightboxOpen(true)}
              >
                {!imgError[activeImageIndex] ? (
                  isVideoUrl(allMediaUrls[activeImageIndex]) ? (
                    <video
                      src={allMediaUrls[activeImageIndex]}
                      controls
                      className="h-full w-full object-contain bg-black"
                      onClick={(e) => e.stopPropagation()}
                      onError={() => setImgError((prev) => ({ ...prev, [activeImageIndex]: true }))}
                    />
                  ) : (
                    <img
                      src={allMediaUrls[activeImageIndex]}
                      alt={`Post media ${activeImageIndex + 1}`}
                      className="h-full w-full object-cover transition-transform duration-500 hover:scale-[1.02]"
                      onError={() => setImgError((prev) => ({ ...prev, [activeImageIndex]: true }))}
                    />
                  )
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center bg-base-200/50 border border-base-content/5 rounded-xl">
                    <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center mb-2">
                       <ImageIcon size={20} className="stroke-base-content/20" />
                    </div>
                    <p className="text-[10px] font-medium text-base-content/40 px-6 text-center">
                      Legacy media currently unavailable
                    </p>
                  </div>
                )}
              </div>

              {allMediaUrls.length > 1 && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); prevImage(); }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-base-100/80 backdrop-blur-sm shadow-md hover:bg-base-100 transition-all z-10"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); nextImage(); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-base-100/80 backdrop-blur-sm shadow-md hover:bg-base-100 transition-all z-10"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
                    {allMediaUrls.map((_, i) => (
                      <button
                        key={i}
                        onClick={(e) => { e.stopPropagation(); setActiveImageIndex(i); }}
                        className={`h-1.5 rounded-full transition-all duration-300 ${i === activeImageIndex ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
                      />
                    ))}
                  </div>
                  <div className="absolute bottom-2.5 right-3 rounded-full bg-black/40 backdrop-blur-sm px-2 py-0.5 text-[11px] text-white z-10">
                    {activeImageIndex + 1}/{allMediaUrls.length}
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Action bar ── */}
          <div className="flex items-center gap-0.5 border-t border-base-content/8 pt-2 -mb-1">
            {/* Like */}
            <ActionPill
              onClick={handleLike}
              active={liked}
              disabled={isResolved}
              activeClass="bg-[#1D4ED8]/10 text-[#1D4ED8]"
            >
              <ArrowUp size={16} />
              <span className="text-xs">{likeCount > 0 ? likeCount : "Like"}</span>
            </ActionPill>

            {/* Dislike (issue only) */}
            {isIssue && (
              <ActionPill
                onClick={handleDislike}
                active={disliked}
                disabled={isResolved}
                activeClass="bg-error/10 text-error"
              >
                <ArrowDown size={16} />
                <span className="text-xs">{dislikeCount > 0 ? dislikeCount : "Dislike"}</span>
              </ActionPill>
            )}

            {/* Comment */}
            <ActionPill onClick={() => setCommentsOpen(!commentsOpen)}>
              <MessageSquare size={16} />
              <span className="text-xs">{post.commentCount > 0 ? post.commentCount : "Comment"}</span>
            </ActionPill>

            {/* Share */}
            <ActionPill onClick={handleShare} active={copied} activeClass="text-success">
              <Share2 size={16} />
              <span className="text-xs">{copied ? "Copied!" : shareCount > 0 ? shareCount : "Share"}</span>
            </ActionPill>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Save */}
            <ActionPill onClick={handleSave} active={saved} activeClass="bg-amber-500/10 text-amber-600">
              <Bookmark size={16} className={saved ? "fill-current" : ""} />
            </ActionPill>
          </div>

          {/* ── Comments ── */}
          <AnimatePresence>
            {isIssue && isResolved ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1.5 rounded-xl bg-base-200 px-3 py-2 text-xs text-base-content/40 overflow-hidden"
              >
                <MessageSquare size={12} />
                Comments are closed — issue resolved.
              </motion.div>
            ) : commentsOpen ? (
              <CommentSection
                postId={post.id}
                postType={commentPostType(post.variant)}
                commentCount={post.commentCount}
                currentUsername={currentUser?.username}
                currentRole={currentUser?.role}
                defaultOpen={true}
              />
            ) : null}
          </AnimatePresence>

          {/* ── Join prompt banner — only for community posts when not a member & not hidden ── */}
          {postHasCommunity && !isJoined && communityId && !hideCommunityStrip && (
            <JoinPromptBanner
              communityName={
                (post as CommunityPost).communityName ||
                (post as any).communityName ||
                "this community"
              }
              onJoin={(e) => { e.stopPropagation(); handleJoinCommunity(communityId); }}
            />
          )}

        </div>
      </motion.div>

      <ResolveModal
        isOpen={resolveOpen}
        onClose={() => setResolveOpen(false)}
        onConfirm={handleResolveConfirm}
      />

      {/* ── Lightbox ── */}
      <AnimatePresence>
        {lightboxOpen && hasMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightboxOpen(false)}
          >
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-10"
            >
              <X size={20} />
            </button>

            {allMediaUrls.length > 1 && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm text-white z-10">
                {activeImageIndex + 1} / {allMediaUrls.length}
              </div>
            )}

            {isVideoUrl(allMediaUrls[activeImageIndex]) ? (
              <motion.video
                key={activeImageIndex}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                src={allMediaUrls[activeImageIndex]}
                controls
                autoPlay
                className="max-h-[88vh] max-w-[92vw] rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <motion.img
                key={activeImageIndex}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                src={allMediaUrls[activeImageIndex]}
                alt=""
                className="max-h-[88vh] max-w-[92vw] rounded-xl object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            )}

            {allMediaUrls.length > 1 && (
              <>
                <button
                  onClick={(e) => { e.stopPropagation(); prevImage(); }}
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <ChevronLeft size={24} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); nextImage(); }}
                  className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
                >
                  <ChevronRight size={24} />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
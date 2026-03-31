import { useState, useEffect, useRef, useCallback } from "react";
import {
  MessageSquare,
  Send,
  Reply,
  Trash2,
  Pencil,
  ChevronDown,
  ChevronUp,
  X,
  Loader2,
  CornerDownRight,
} from "lucide-react";

// ─── auth helper ──────────────────────────────────────────────────────────────
function authHeaders(): HeadersInit {
  const token =
    localStorage.getItem("authToken") ?? localStorage.getItem("token") ?? "";
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

async function apiFetch(url: string) {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPost(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      const errRes = await res.json();
      const details = errRes.error ? ` [${errRes.error}]` : "";
      msg += ` - ${errRes.message || JSON.stringify(errRes)}${details}`;
    } catch {
      msg += ` - ${await res.text()}`;
    }
    throw new Error(msg);
  }
  return res.json();
}

async function apiPut(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiDelete(url: string) {
  const res = await fetch(url, { method: "DELETE", headers: authHeaders() });
  if (!res.ok) throw new Error(`${res.status}`);
}

// ─── types ────────────────────────────────────────────────────────────────────
// "post"         → /api/comments/post/{id}          (Issue posts)
// "social-posts" → /api/comments/social-posts/{id}  (Social / Community / Govt / Poll)
export type PostType = "post" | "social-posts";

// Backend CommentDto uses `text` (not `content`) and nests user info
// under `author: { username, displayName, ... }` via AuthorDto.
export type AuthorDto = {
  username: string;
  displayName?: string;
  profileImageUrl?: string;
  pincode?: string;
};

export type CommentDto = {
  id: number;
  text: string;                      // backend field is `text`, not `content`
  createdAt: string;
  updatedAt?: string;
  author: AuthorDto;                  // nested, not flat username/userDisplayName
  parentCommentId?: number | null;
  replyCount?: number;
  replies?: CommentDto[];
};

type PaginatedResponse<T> = {
  content: T[];
  hasMore: boolean;
  nextCursor?: number;
};

// ─── props ────────────────────────────────────────────────────────────────────
type CommentSectionProps = {
  postId: number;
  postType: PostType;
  commentCount?: number;
  currentUsername?: string;
  currentRole?: "ROLE_USER" | "ROLE_DEPARTMENT" | "ROLE_ADMIN";
  defaultOpen?: boolean;
};

// ─── helpers ──────────────────────────────────────────────────────────────────
function timeAgo(raw: string | undefined): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// Reads display name from nested AuthorDto.
// Falls back to author.username if displayName is absent.
function displayName(comment: CommentDto): string {
  return comment.author?.displayName ?? comment.author?.username ?? "Unknown";
}

const LIMIT = 10;

// ═══════════════════════════════════════════════════════════════════════════════
// CommentInput
// ═══════════════════════════════════════════════════════════════════════════════
function CommentInput({
  placeholder,
  initialValue = "",
  onSubmit,
  onCancel,
  submitLabel = "Post",
  autoFocus = false,
}: {
  placeholder: string;
  initialValue?: string;
  onSubmit: (text: string) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  autoFocus?: boolean;
}) {
  const [text, setText] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);

  async function submit() {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(trimmed);
      setText("");
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit();
  }

  return (
    <div className="space-y-1.5">
      <textarea
        ref={ref}
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        disabled={busy}
        className="textarea textarea-bordered w-full resize-none text-sm leading-snug"
      />
      {error && <p className="text-xs text-error">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button onClick={onCancel} disabled={busy} className="btn btn-ghost btn-xs">
            <X size={13} /> Cancel
          </button>
        )}
        <button
          onClick={submit}
          disabled={busy || !text.trim()}
          className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-xs gap-1"
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SingleComment — one comment row with edit / delete / reply / nested replies
// ═══════════════════════════════════════════════════════════════════════════════
type SingleCommentProps = {
  comment: CommentDto;
  postId: number;
  postType: PostType;
  depth: number;
  currentUsername?: string;
  currentRole?: string;
  onDeleted: (id: number) => void;
  onUpdated: (updated: CommentDto) => void;
  onReplyAdded: (parentId: number, reply: CommentDto) => void;
};

function SingleComment({
  comment,
  postId,
  postType,
  depth,
  currentUsername,
  currentRole,
  onDeleted,
  onUpdated,
  onReplyAdded,
}: SingleCommentProps) {
  const [showReplyBox, setShowReplyBox] = useState(false);
  const [editing, setEditing] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const [replies, setReplies] = useState<CommentDto[]>(comment.replies ?? []);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [repliesCursor, setRepliesCursor] = useState<number | undefined>();
  const [hasMoreReplies, setHasMoreReplies] = useState(
    (comment.replyCount ?? 0) > 0 && (comment.replies ?? []).length === 0
  );
  const [deleting, setDeleting] = useState(false);

  // Owner check reads from comment.author.username (nested AuthorDto)
  const isOwner = !!currentUsername && comment.author?.username === currentUsername;
  const isAdmin = currentRole === "ROLE_ADMIN";
  const replyCount = comment.replyCount ?? replies.length;

  async function loadReplies(cursor?: number) {
    setLoadingReplies(true);
    try {
      const params = new URLSearchParams({ limit: String(LIMIT) });
      if (cursor) params.set("beforeId", String(cursor));
      const res = await apiFetch(`/api/comments/${comment.id}/replies?${params}`);
      const page: PaginatedResponse<CommentDto> = res?.data ?? res;
      const fetched: CommentDto[] = page?.content ?? [];
      setReplies((prev) => (cursor ? [...prev, ...fetched] : fetched));
      setHasMoreReplies(page?.hasMore ?? false);
      setRepliesCursor(page?.nextCursor);
    } catch {
      // silently ignore
    } finally {
      setLoadingReplies(false);
    }
  }

  function toggleReplies() {
    if (!repliesOpen && replies.length === 0 && replyCount > 0) {
      loadReplies();
    }
    setRepliesOpen((v) => !v);
  }

  async function handleReply(text: string) {
    const endpoint =
      postType === "post"
        ? `/api/comments/post/${postId}`
        : `/api/comments/social-posts/${postId}`;
    // Backend CommentCreateDto uses `text` + `parentCommentId`
    const res = await apiPost(endpoint, {
      text,
      parentCommentId: comment.id,
    });
    const created: CommentDto = res?.data ?? res;
    setReplies((prev) => [created, ...prev]);
    setRepliesOpen(true);
    setShowReplyBox(false);
    onReplyAdded(comment.id, created);
  }

  async function handleEdit(text: string) {
    // Backend CommentUpdateDto uses `text`
    const res = await apiPut(`/api/comments/${comment.id}`, { text });
    const updated: CommentDto = res?.data ?? res;
    onUpdated({ ...comment, text: updated.text });
    setEditing(false);
  }

  async function handleDelete() {
    if (!window.confirm("Delete this comment?")) return;
    setDeleting(true);
    try {
      await apiDelete(`/api/comments/${comment.id}`);
      onDeleted(comment.id);
    } catch {
      setDeleting(false);
    }
  }

  const indentClass =
    depth === 0 ? "" : "ml-4 border-l-2 border-base-300 pl-3";

  const authorName = displayName(comment);
  const avatarSrc = comment.author?.profileImageUrl
    || `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(comment.author?.username ?? "?")}`;

  return (
    <div className={`${indentClass} space-y-1`}>
      {/* Comment bubble */}
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full overflow-hidden bg-base-200 border border-base-300">
          <img src={avatarSrc} alt={authorName} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-xs font-semibold">{authorName}</span>
            <span className="text-xs opacity-40">{timeAgo(comment.createdAt)}</span>
            {comment.updatedAt && comment.updatedAt !== comment.createdAt && (
              <span className="text-xs opacity-30 italic">(edited)</span>
            )}
          </div>

          {/* Content or edit box */}
          {editing ? (
            <div className="mt-1">
              <CommentInput
                placeholder="Edit your comment…"
                initialValue={comment.text}
                onSubmit={handleEdit}
                onCancel={() => setEditing(false)}
                submitLabel="Save"
                autoFocus
              />
            </div>
          ) : (
            <p className="mt-0.5 text-sm leading-snug whitespace-pre-wrap break-words">
              {comment.text}
            </p>
          )}

          {/* Action row */}
          {!editing && (
            <div className="mt-1 flex items-center gap-3 text-xs">
              {depth < 4 && (
                <button
                  onClick={() => setShowReplyBox((v) => !v)}
                  className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Reply size={12} /> Reply
                </button>
              )}
              {isOwner && (
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1 opacity-50 hover:opacity-100 transition-opacity"
                >
                  <Pencil size={12} /> Edit
                </button>
              )}
              {(isOwner || isAdmin) && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center gap-1 opacity-50 hover:text-error hover:opacity-100 transition-opacity"
                >
                  {deleting ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Trash2 size={12} />
                  )}
                  Delete
                </button>
              )}
              {replyCount > 0 && (
                <button
                  onClick={toggleReplies}
                  className="flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity ml-1"
                >
                  <CornerDownRight size={12} />
                  {repliesOpen
                    ? "Hide"
                    : `${replyCount} ${replyCount === 1 ? "reply" : "replies"}`}
                  {repliesOpen ? (
                    <ChevronUp size={11} />
                  ) : (
                    <ChevronDown size={11} />
                  )}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Reply input */}
      {showReplyBox && (
        <div className="ml-9 mt-1.5">
          <CommentInput
            placeholder={`Reply to ${authorName}…`}
            onSubmit={handleReply}
            onCancel={() => setShowReplyBox(false)}
            submitLabel="Reply"
            autoFocus
          />
        </div>
      )}

      {/* Nested replies */}
      {repliesOpen && (
        <div className="mt-1.5 space-y-3">
          {loadingReplies && replies.length === 0 && (
            <div className="flex items-center gap-2 ml-9 text-xs opacity-50">
              <Loader2 size={12} className="animate-spin" /> Loading replies…
            </div>
          )}
          {replies.map((reply) => (
            <SingleComment
              key={reply.id}
              comment={reply}
              postId={postId}
              postType={postType}
              depth={depth + 1}
              currentUsername={currentUsername}
              currentRole={currentRole}
              onDeleted={(id) =>
                setReplies((prev) => prev.filter((r) => r.id !== id))
              }
              onUpdated={(updated) =>
                setReplies((prev) =>
                  prev.map((r) => (r.id === updated.id ? updated : r))
                )
              }
              onReplyAdded={onReplyAdded}
            />
          ))}
          {hasMoreReplies && (
            <button
              onClick={() => loadReplies(repliesCursor)}
              disabled={loadingReplies}
              className="ml-9 flex items-center gap-1 text-xs opacity-60 hover:opacity-100"
            >
              {loadingReplies ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <ChevronDown size={12} />
              )}
              Load more replies
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CommentSection — main exported component
// ═══════════════════════════════════════════════════════════════════════════════
export default function CommentSection({
  postId,
  postType,
  commentCount: initialCount = 0,
  currentUsername,
  currentRole,
  defaultOpen = false,
}: CommentSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<number | undefined>();
  const [count, setCount] = useState(initialCount);
  const [fetchedOnce, setFetchedOnce] = useState(false);

  const fetchComments = useCallback(
    async (beforeId?: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ limit: String(LIMIT) });
        if (beforeId) params.set("beforeId", String(beforeId));
        const endpoint =
          postType === "post"
            ? `/api/comments/post/${postId}/top-level?${params}`
            : `/api/comments/social-posts/${postId}/top-level?${params}`;
        const res = await apiFetch(endpoint);
        const page: PaginatedResponse<CommentDto> = res?.data ?? res;
        const fetched: CommentDto[] = page?.content ?? [];
        setComments((prev) => (beforeId ? [...prev, ...fetched] : fetched));
        setHasMore(page?.hasMore ?? false);
        setCursor(page?.nextCursor);
        setFetchedOnce(true);
      } catch {
        // silently ignore
      } finally {
        setLoading(false);
      }
    },
    [postId, postType]
  );

  useEffect(() => {
    if (open && !fetchedOnce) fetchComments();
  }, [open, fetchedOnce, fetchComments]);

  async function handleNewComment(text: string) {
    const endpoint =
      postType === "post"
        ? `/api/comments/post/${postId}`
        : `/api/comments/social-posts/${postId}`;
    // Backend CommentCreateDto uses `text` only — controller resolves post from URL path
    const res = await apiPost(endpoint, { text });
    const created: CommentDto = res?.data ?? res;
    setComments((prev) => [created, ...prev]);
    setCount((n) => n + 1);
  }

  function handleReplyAdded(_parentId: number, _reply: CommentDto) {
    setCount((n) => n + 1);
  }

  function handleDeleted(id: number) {
    setComments((prev) => prev.filter((c) => c.id !== id));
    setCount((n) => Math.max(0, n - 1));
  }

  function handleUpdated(updated: CommentDto) {
    setComments((prev) =>
      prev.map((c) => (c.id === updated.id ? updated : c))
    );
  }

  return (
    <div className="mt-2">
      {/* Toggle bar */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs opacity-70 hover:opacity-100 hover:bg-base-300/40 transition-colors"
      >
        <MessageSquare size={14} />
        <span className="font-medium">
          {count > 0
            ? `${count} comment${count !== 1 ? "s" : ""}`
            : "Comments"}
        </span>
        {open ? (
          <ChevronUp size={13} className="ml-auto" />
        ) : (
          <ChevronDown size={13} className="ml-auto" />
        )}
      </button>

      {/* Body */}
      {open && (
        <div className="mt-2 space-y-4 rounded-xl border border-base-300 bg-base-100 p-3">
          {/* New comment input */}
          <CommentInput
            placeholder="Write a comment… (Ctrl+Enter to post)"
            onSubmit={handleNewComment}
          />

          {loading && comments.length === 0 && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm opacity-50">
              <Loader2 size={16} className="animate-spin" /> Loading comments…
            </div>
          )}

          {!loading && fetchedOnce && comments.length === 0 && (
            <p className="py-4 text-center text-sm opacity-40">
              No comments yet. Be the first!
            </p>
          )}

          {comments.length > 0 && (
            <div className="space-y-4">
              {comments.map((c) => (
                <SingleComment
                  key={c.id}
                  comment={c}
                  postId={postId}
                  postType={postType}
                  depth={0}
                  currentUsername={currentUsername}
                  currentRole={currentRole}
                  onDeleted={handleDeleted}
                  onUpdated={handleUpdated}
                  onReplyAdded={handleReplyAdded}
                />
              ))}
            </div>
          )}

          {hasMore && (
            <button
              onClick={() => fetchComments(cursor)}
              disabled={loading}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-base-300 py-2 text-xs opacity-60 hover:opacity-100 transition-opacity"
            >
              {loading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <ChevronDown size={13} />
              )}
              Load more comments
            </button>
          )}
        </div>
      )}
    </div>
  );
}
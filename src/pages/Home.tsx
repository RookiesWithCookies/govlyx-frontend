import { useState, useEffect, useCallback, useRef } from "react";
import { Flame, Clock, ArrowUp, SlidersHorizontal, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PostCard from "../components/post/PostCard";
import type { AnyPost } from "../components/post/PostCard";
import EmptyState from "../components/ui/EmptyState";
import PostSkeleton from "../components/post/PostSkeleton";
import axiosInstance from "../api/axiosConfig";
import { toPostCardPost } from "../utils/postUtils";
import { postService } from "../api/postService";


const FEED_SIZE = 20;


function useFeed(sourceTab: string, sortTab: string) {
  const [posts, setPosts] = useState<AnyPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState(false);

  const fetchPage = useCallback(
    async (cursor: number | null, replace: boolean) => {
      setLoading(true);
      setError(null);
      if (replace) {
        setInitialLoading(true);
        setPosts([]);
      }

      try {
        const params = {
          sort: sortTab.toUpperCase(),
          size: FEED_SIZE,
          ...(cursor !== null && { lastPostId: cursor })
        };

        // Map frontend tabs to backend endpoints
        let endpoint = "/api/v1/feed/for-you";
        if (sourceTab === "location") endpoint = "/api/v1/feed/local";
        else if (sourceTab === "following") endpoint = "/api/v1/feed/following";
        else if (sourceTab === "official") endpoint = "/api/v1/feed/official";

        const res = await axiosInstance.get(endpoint, { params });
        const json = res.data;

        // ── Robust Data Mapping ───────────────────────────────────────────────
        /** 
         * Logic:
         * 1. If wrapped in ApiResponse: { success: true, data: { data: [...], hasMore: true } }
         * 2. If direct PaginatedResponse: { data: [...], hasMore: true } 
         */
        const isWrapped = json.success !== undefined && json.data !== undefined;
        const container = isWrapped ? json.data : json;

        // Identify the list of posts
        let items: any[] = [];
        if (Array.isArray(container)) {
          items = container;
        } else if (container && typeof container === "object") {
          items = container.data ?? container.content ?? [];
        }

        const mapped = items.map(toPostCardPost);

        setPosts((prev) => {
          const combined = replace ? mapped : [...prev, ...mapped];
          const map = new Map<string, AnyPost>();
          combined.forEach((item: AnyPost) => {
            map.set(item.id + "-" + item.variant, item);
          });
          return Array.from(map.values());
        });

        // Extract metadata from the container layer (not the list layer)
        setHasMore(container?.hasMore ?? false);
        setNextCursor(container?.nextCursor ?? null);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load feed");
        setHasMore(false);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [sourceTab, sortTab]
  );

  useEffect(() => {
    fetchPage(null, true);
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore && !fatalError) fetchPage(nextCursor, false);
  }, [loading, hasMore, fatalError, nextCursor, fetchPage]);

  const retry = useCallback(() => {
    setFatalError(false);
    fetchPage(null, true);
  }, [fetchPage]);

  const updatePost = useCallback((postId: number, changes: Partial<AnyPost>) => {
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? ({ ...p, ...changes } as AnyPost) : p))
    );
  }, []);

  const prependPost = useCallback((rawPost: any) => {
    const mapped = toPostCardPost(rawPost);
    setPosts((prev) => {
      const combined = [mapped, ...prev] as AnyPost[];
      const map = new Map<string, AnyPost>();
      combined.forEach((item: AnyPost) => {
        map.set(item.id + "-" + item.variant, item);
      });
      return Array.from(map.values());
    });
  }, []);

  return { posts, loading, initialLoading, hasMore, error, fatalError, loadMore, retry, updatePost, prependPost, setPosts };
}

function InfiniteScrollTrigger({ onIntersect }: { onIntersect: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onIntersect);
  useEffect(() => { cbRef.current = onIntersect; }, [onIntersect]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) cbRef.current(); },
      { threshold: 0.1, rootMargin: "0px 0px 200px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return <div ref={ref} className="h-4" />;
}

const SOURCE_TABS: { key: "all" | "location" | "following" | "official"; label: string }[] = [
  { key: "all", label: "For You" },
  { key: "location", label: "Location" },
  { key: "following", label: "Following" },
  { key: "official", label: "Official" },
];

const SORT_TABS: { key: "hot" | "new" | "top"; label: string; icon: any }[] = [
  { key: "hot", label: "Hot", icon: Flame },
  { key: "new", label: "New", icon: Clock },
  { key: "top", label: "Top", icon: ArrowUp },
];

const Home = () => {
  const [sourceTab, setSourceTab] = useState<"all" | "location" | "following" | "official">("all");
  const [sortTab, setSortTab] = useState<"hot" | "new" | "top">("hot");
  const [showFilters, setShowFilters] = useState(false);
  const [showSort, setShowSort] = useState(false);

  const { posts, loading, initialLoading, hasMore, error, fatalError, loadMore, retry, updatePost, prependPost, setPosts } =
    useFeed(sourceTab, sortTab);

  const handleLike = useCallback((postId: number, liked: boolean) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    updatePost(postId, { isLikedByCurrentUser: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
  }, [posts, updatePost]);

  const handleSave = useCallback((postId: number, saved: boolean) => {
    updatePost(postId, { isSaved: saved } as Partial<AnyPost>);
  }, [updatePost]);

  const handleShare = useCallback((postId: number) => {
    navigator.clipboard?.writeText(`${window.location.origin}/post/${postId}`).catch(() => { });
  }, []);

  const handleComment = useCallback((postId: number) => {
    window.location.href = `/post/${postId}`;
  }, []);

  const handleVote = useCallback(async (pollId: number, optionIds: number[]) => {
    try {
      await postService.voteInPoll(pollId, optionIds);
      const post = posts.find(p => p.variant === 'poll' && p.pollId === pollId);
      if (post) {
        updatePost(post.id, { userHasVoted: true, votedOptionIds: optionIds } as any);
      }
    } catch (err) {
      console.error("Vote error:", err);
    }
  }, [posts, updatePost]);

  const handleDelete = useCallback(async (postId: number) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    let endpoint = `/api/social-posts/${postId}`;
    if (post.variant === "issue") endpoint = `/api/posts/${postId}`;
    else if (post.variant === "social" && post.isPoll) endpoint = `/api/polls/${post.pollId}`;
    try {
      const res = await axiosInstance.delete(endpoint);
      if (res.status === 200 || res.status === 204) setPosts(prev => prev.filter(p => p.id !== postId));
      else {
        const errorData = res.data || {};
        alert(errorData.message || "Failed to delete post.");
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("An error occurred while deleting the post.");
    }
  }, [posts, setPosts]);

  useEffect(() => {
    const onPostCreated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newPostData = customEvent.detail?.post;
      if (newPostData) prependPost(newPostData);
      else retry();
    };
    window.addEventListener("postCreated", onPostCreated);
    return () => window.removeEventListener("postCreated", onPostCreated);
  }, [retry, prependPost]);

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-30">
        <div className="flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-100/90 p-2 backdrop-blur-md shadow-sm lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex lg:hidden items-center justify-between px-2 py-1">
            <span className="text-sm font-bold opacity-60">Feed Filters</span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-sm font-bold ${showFilters ? "bg-[#1D4ED8] text-white border-primary shadow-md" : "bg-base-200 border-base-300 text-base-content/70"}`}
            >
              <SlidersHorizontal size={16} />
              {showFilters ? "Hide" : "Explore"}
            </button>
          </div>
          <AnimatePresence>
            {(showFilters || window.innerWidth >= 1024) && (
              <motion.div
                initial={window.innerWidth < 1024 ? { height: 0, opacity: 0 } : false}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between lg:w-full lg:gap-4"
              >
                <div className="flex items-center justify-between gap-2 overflow-hidden">
                  <div className="flex gap-1 bg-base-200/50 p-1 rounded-xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
                    {SOURCE_TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setSourceTab(t.key)}
                        className={`flex-none rounded-lg px-4 py-1.5 text-sm font-bold transition-all whitespace-nowrap ${sourceTab === t.key ? "bg-[#1D4ED8] text-white shadow-md" : "text-base-content/70 hover:text-base-content hover:bg-base-300/50"}`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setShowSort(!showSort)}
                    className={`lg:hidden flex items-center justify-center p-2 h-[38px] w-[38px] rounded-xl border transition-all ${showSort ? "bg-[#1D4ED8]/10 border-primary/30 text-primary" : "bg-base-200 border-base-300 text-base-content/60"}`}
                  >
                    <Clock size={18} />
                  </button>
                </div>
                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4 lg:flex-1 lg:justify-end">
                  <AnimatePresence>
                    {(showSort || window.innerWidth >= 1024) && (
                      <motion.div
                        initial={window.innerWidth < 1024 ? { height: 0, opacity: 0 } : false}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex gap-1 bg-base-200/50 p-1 rounded-xl lg:bg-transparent lg:p-0 overflow-hidden"
                      >
                        <div className="flex gap-1 bg-base-200/50 p-1 rounded-xl w-full lg:w-auto overflow-x-auto scrollbar-hide">
                          {SORT_TABS.map((t) => (
                            <button
                              key={t.key}
                              onClick={() => { setSortTab(t.key); if (window.innerWidth < 1024) setShowSort(false); }}
                              className={`flex flex-none lg:flex-none items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold transition-all whitespace-nowrap ${sortTab === t.key ? "bg-[#1D4ED8] text-white shadow-md" : "text-base-content/70 hover:text-base-content hover:bg-base-300/50"}`}
                            >
                              <t.icon size={16} />
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error flex items-center justify-between gap-3">
          <span>{error}</span>
          {fatalError ? (
            <a href="/login" className="shrink-0 underline font-medium">Log in</a>
          ) : (
            <button className="shrink-0 underline font-medium" onClick={retry}>Retry</button>
          )}
        </div>
      )}

      {/* Single Column Feed Layout */}
      <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto">
        {initialLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <PostSkeleton key={`sk-${i}`} />
          ))
        ) : posts.length === 0 && !loading && !error ? (
          <div className="w-full">
            <EmptyState title="Nothing here yet" description="Be the first to post, or try a different tab." />
          </div>
        ) : (
          posts.map((post) => (
            <div key={`${post.id}-${post.variant}`} className="w-full">
              <PostCard
                post={post}
                onLike={handleLike}
                onSave={handleSave}
                onShare={handleShare}
                onComment={handleComment}
                onVote={handleVote}
                onDelete={handleDelete}
              />
            </div>
          ))
        )}

        {!initialLoading && loading && (
          Array.from({ length: 2 }).map((_, i) => (
            <PostSkeleton key={`more-sk-${i}`} />
          ))
        )}

        {!initialLoading && hasMore && !loading && !error && (
          <div className="w-full pt-8">
            <InfiniteScrollTrigger onIntersect={loadMore} />
          </div>
        )}

        {!hasMore && posts.length > 0 && !error && (
          <div className="w-full">
            <p className="py-12 text-center text-xs opacity-40 font-bold tracking-widest uppercase flex items-center justify-center gap-2">
              <Sparkles size={16} className="text-amber-400" />
              You've reached the end of the feed
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;

import { useState, useEffect, useCallback, useRef } from "react";
import { Flame, Clock, ArrowUp, SlidersHorizontal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import PostCard from "../components/post/PostCard";
import type { AnyPost, SocialPost, GovernmentPost } from "../components/post/PostCard";
import EmptyState from "../components/ui/EmptyState";
import Skeleton from "../components/ui/Skeleton";

interface PaginatedResponse<T> {
  content: T[];
  hasMore: boolean;
  nextCursor: number | null;
  size: number;
}

interface SocialPostDto {
  id: number;
  content: string;
  timeAgo?: string;
  username: string;
  userDisplayName?: string;
  userProfileImage?: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  isLikedByCurrentUser?: boolean;
  isSaved?: boolean;
  hashtags?: string[];
  isGovernmentBroadcast?: boolean;
  department?: string;
  broadcastScope?: "AREA" | "DISTRICT" | "STATE" | "COUNTRY";
  broadcastScopeDescription?: string;
}

type FeedTab = "all" | "location" | "following" | "hot" | "new" | "top" | "for-you" | "official";

function getAuthToken(): string | null {
  return localStorage.getItem("token") || "demo-token-123";
}

function toPostCardPost(dto: any): AnyPost {
  if (dto.isBroadcastPost || dto.broadcastScope) {
    return {
      ...dto,
      variant: "government",
      department: dto.department ?? dto.userDisplayName ?? dto.username,
      isGovernmentBroadcast: true,
      commentCount: dto.commentCount ?? 0,
      likeCount: dto.likeCount ?? 0,
      shareCount: dto.shareCount ?? 0,
    } as GovernmentPost;
  }
  if (dto.status || dto.targetPincode) {
    return {
      ...dto,
      variant: "issue",
      commentCount: dto.commentCount ?? 0,
      likeCount: dto.likeCount ?? 0,
      shareCount: dto.shareCount ?? 0,
    } as AnyPost;
  }
  return { ...dto, variant: "social" } as SocialPost;
}

const FEED_SIZE = 20;

const PostSkeleton = () => (
  <div className="rounded-xl border border-base-300 bg-base-200 p-4 space-y-3 animate-pulse">
    <div className="flex items-center gap-2">
      <Skeleton className="h-4 w-1/4" />
      <Skeleton className="h-4 w-12" />
    </div>
    <Skeleton className="h-3 w-full" />
    <Skeleton className="h-3 w-5/6" />
    <Skeleton className="h-3 w-4/6" />
    <div className="flex gap-3 pt-1">
      <Skeleton className="h-7 w-14" />
      <Skeleton className="h-7 w-14" />
      <Skeleton className="h-7 w-14" />
    </div>
  </div>
);

function useFeed(tab: FeedTab) {
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
      try {
        const token = getAuthToken();
        const params = new URLSearchParams({ limit: String(FEED_SIZE) });
        if (cursor !== null) params.set("beforeId", String(cursor));
        if (tab === "hot" || tab === "new" || tab === "top") params.set("sort", tab);
        
        // Map frontend tabs to backend endpoints
        let endpoints: string[] = [];
        if (tab === "for-you") {
          endpoints = [
            `/api/feeds/enhanced/mixed`, 
            `/api/social-posts/feed/home`, 
            `/api/social-posts/feed/trending`,
            `/api/social-posts/my-posts`
          ];
        } else if (tab === "location") {
          endpoints = [`/api/feeds/enhanced/area`, `/api/social-posts/feed/local`, `/api/social-posts/my-posts`];
        } else if (tab === "following") {
          endpoints = [`/api/social-posts/feed/home`];
        } else if (tab === "official") {
          endpoints = [`/api/feeds/enhanced/country`];
        } else {
          endpoints = [
            `/api/feeds/enhanced/mixed`, 
            `/api/social-posts/feed/home`, 
            `/api/social-posts/feed/trending`,
            `/api/social-posts/my-posts`
          ];
        }

        const responses = await Promise.all(
          endpoints.map((ep) =>
            fetch(`${ep}?${params}`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }).catch(() => null)
          )
        );

        let mergedData: any[] = [];
        let anyHasMore = false;
        let newCursor: number | null = null;
        let authError = false;

        for (const res of responses) {
          if (!res) continue;
          if (res.status === 401 || res.status === 403) {
            authError = true;
            continue;
          }
          if (!res.ok) continue;

          const data: any = await res.json().catch(() => ({}));
          const pageData = data.data ?? data;
          const items = pageData.content ?? pageData.items ?? [];
          mergedData = [...mergedData, ...items];
          if (pageData.hasMore || pageData.hasNextPage) anyHasMore = true;
          
          // Try to get the lowest ID for cursor
          const next = pageData.nextCursor ?? pageData.lastId ?? pageData.nextCursorId;
          if (next && (!newCursor || next < newCursor)) {
            newCursor = next;
          }
        }

        if (authError && mergedData.length === 0) {
          setFatalError(true);
          setHasMore(false);
          throw new Error("Not authenticated — please log in.");
        }

        const mapped = mergedData
          .map(toPostCardPost)
          // Simple client-side descending sort by ID (newest first)
          .sort((a, b) => b.id - a.id);

        setPosts((prev) => {
          // Keep unique IDs
          const combined = replace ? mapped : [...prev, ...mapped];
          const unique = Array.from(new Map(combined.map((item) => [item.id + "-" + item.variant, item])).values());
          return unique;
        });

        setHasMore(anyHasMore);
        setNextCursor(newCursor);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load feed");
        setHasMore(false);
      } finally {
        setLoading(false);
        setInitialLoading(false);
      }
    },
    [tab]
  );

  useEffect(() => {
    fetchPage(null, true);
  }, [tab, fetchPage]);

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
      return Array.from(new Map(combined.map((item) => [item.id + "-" + item.variant, item])).values());
    });
  }, []);

  return { posts, loading, initialLoading, hasMore, error, fatalError, loadMore, retry, updatePost, prependPost };
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
  
  const getBackendTab = (): FeedTab => {
    if (sourceTab === "all") return sortTab;
    if (sourceTab === "location") return "for-you";
    return sourceTab;
  };

  const { posts, loading, initialLoading, hasMore, error, fatalError, loadMore, retry, updatePost, prependPost } =
    useFeed(getBackendTab());

  const handleLike = useCallback((postId: number, liked: boolean) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    updatePost(postId, { isLikedByCurrentUser: liked, likeCount: post.likeCount + (liked ? 1 : -1) });
  }, [posts, updatePost]);

  const handleSave = useCallback((postId: number, saved: boolean) => {
    updatePost(postId, { isSaved: saved } as Partial<AnyPost>);
  }, [updatePost]);

  const handleShare = useCallback((postId: number) => {
    navigator.clipboard?.writeText(`${window.location.origin}/post/${postId}`).catch(() => {});
  }, []);

  const handleComment = useCallback((postId: number) => {
    window.location.href = `/post/${postId}`;
  }, []);

  useEffect(() => {
    const onPostCreated = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newPostData = customEvent.detail?.post;
      if (newPostData) {
        // Immediately prepend the new post to the feed without a full refetch
        prependPost(newPostData);
      } else {
        // No post data in event, fall back to full refetch
        retry();
      }
    };
    window.addEventListener("postCreated", onPostCreated);
    return () => window.removeEventListener("postCreated", onPostCreated);
  }, [retry, prependPost]);

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-30">
        <div className="flex flex-col gap-2 rounded-2xl border border-base-300 bg-base-100/90 p-2 backdrop-blur-md shadow-sm lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          
          {/* Mobile Top Header (Toggle) */}
          <div className="flex lg:hidden items-center justify-between px-2 py-1">
            <span className="text-sm font-bold opacity-60">Feed Filters</span>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-sm font-bold ${
                showFilters ? "bg-blue-700 text-white border-blue-700 shadow-md" : "bg-base-200 border-base-300 text-base-content/70"
              }`}
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
                <div className="flex items-center justify-between gap-2">
                  {/* Left: Source Tabs */}
                  <div className="flex gap-1 bg-base-200/50 p-1 rounded-xl w-full lg:w-auto">
                    {SOURCE_TABS.map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setSourceTab(t.key)}
                        className={`flex-1 lg:flex-none rounded-lg px-4 py-1.5 text-sm font-bold transition-all whitespace-nowrap ${
                          sourceTab === t.key 
                            ? "bg-blue-700 text-white shadow-md" 
                            : "text-base-content/70 hover:text-base-content hover:bg-base-300/50"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>

                  {/* Sort Toggle (Mobile only, visible when filters are expanded) */}
                  <button
                    onClick={() => setShowSort(!showSort)}
                    className={`lg:hidden flex items-center justify-center p-2 h-[38px] w-[38px] rounded-xl border transition-all ${
                      showSort ? "bg-blue-100 border-blue-300 text-blue-700" : "bg-base-200 border-base-300 text-base-content/60"
                    }`}
                  >
                    <Clock size={18} />
                  </button>
                </div>

                <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:gap-4 lg:flex-1 lg:justify-end">


                  {/* Right: Sort Tabs (Desktop always, Mobile toggled) */}
                  <AnimatePresence>
                    {(showSort || window.innerWidth >= 1024) && (
                      <motion.div 
                        initial={window.innerWidth < 1024 ? { height: 0, opacity: 0 } : false}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="flex gap-1 bg-base-200/50 p-1 rounded-xl lg:bg-transparent lg:p-0 overflow-hidden"
                      >
                        <div className="flex gap-1 bg-base-200/50 p-1 rounded-xl w-full lg:w-auto">
                          {SORT_TABS.map((t) => (
                            <button
                              key={t.key}
                              onClick={() => { setSortTab(t.key); if (window.innerWidth < 1024) setShowSort(false); }}
                              className={`flex flex-1 lg:flex-none items-center justify-center gap-2 rounded-lg px-4 py-1.5 text-sm font-bold transition-all ${
                                sortTab === t.key 
                                  ? "bg-blue-700 text-white shadow-md" 
                                  : "text-base-content/70 hover:text-base-content hover:bg-base-300/50"
                              }`}
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

      <div className="space-y-3">
        {initialLoading ? (
          Array.from({ length: 5 }).map((_, i) => <PostSkeleton key={i} />)
        ) : posts.length === 0 && !loading && !error ? (
          <EmptyState title="Nothing here yet" description="Be the first to post, or try a different tab." />
        ) : (
          posts.map((post) => (
            <PostCard key={post.id} post={post} onLike={handleLike} onSave={handleSave} onShare={handleShare} onComment={handleComment} />
          ))
        )}

        {!initialLoading && loading &&
          Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={`more-${i}`} />)}

        {!initialLoading && hasMore && !loading && !error && (
          <InfiniteScrollTrigger onIntersect={loadMore} />
        )}

        {!hasMore && posts.length > 0 && !error && (
          <p className="py-4 text-center text-xs opacity-40">You've reached the end.</p>
        )}
      </div>
    </div>
  );
};

export default Home;
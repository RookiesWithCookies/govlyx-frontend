import { useState, useEffect, useRef, useCallback } from "react";
import { FiSearch } from "react-icons/fi";
import { HiOutlineArrowRight, HiOutlineArrowLeft } from "react-icons/hi";
import { useNavigate, useParams } from "react-router-dom";
import { 
  Building2, Construction, GraduationCap, Stethoscope, Leaf, 
  Laptop, Trophy, Palette, Briefcase, HardHat, ShieldCheck, 
  Globe, Lock, EyeOff, Users, Mail, ClipboardCheck, 
  CheckCircle2, AlertTriangle, Inbox, Settings, BarChart3, 
  X, Crown, Shield, User, VolumeX, Volume2, Ban, Trash2, 
  Save, Archive, Pencil, Heart, MessageSquare, Calendar, 
  Tag, MapPin, Rocket, PartyPopper, Plus, ChevronLeft, 
  XCircle, Home, Link, Eye, Image as ImageIcon, RefreshCw
} from "lucide-react";
import CommunityCard from "../components/community/CommunityCard";
import CommunityHeader from "../components/community/CommunityHeader";
import CommunityTabs from "../components/community/CommunityTabs";
import CommunitySidebar from "../components/community/CommunitySidebar";

/* ─── auth ──────────────────────────────────────────────────────────────── */
function getToken(): string | null {
  return (
    localStorage.getItem("authToken") ||
    localStorage.getItem("token") ||
    localStorage.getItem("jwt") ||
    localStorage.getItem("access_token") ||
    null
  );
}
function hdrs(): Record<string, string> {
  const t = getToken();
  return t
    ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

/* ─── types ─────────────────────────────────────────────────────────────── */
interface CommunityData {
  id: number;
  name: string;
  slug: string;
  description: string;
  category: string | null;
  tags: string[] | string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  privacy: "PUBLIC" | "PRIVATE" | "SECRET";
  locationName: string | null;
  memberCount: number;
  postCount: number;
  isMember: boolean;
  isOwner: boolean;
  hasPendingRequest?: boolean;
  allowMemberPosts?: boolean;
  requirePostApproval?: boolean;
  feedEligible?: boolean;
  healthTierEmoji?: string | null;
  createdAt: string;
  owner?: { id: number; username: string; profileImage: string | null } | null;
}

interface Post {
  id: number;
  content: string;
  authorName?: string;
  likeCount: number;
  commentCount: number;
  timeAgo?: string;
  createdAt?: string;
}

interface Paged<T> {
  content: T[];
  hasMore: boolean;
  nextCursor: number | null;
}

interface CreateForm {
  name: string;
  description: string;
  category: string;
  tags: string;
  privacy: "PUBLIC" | "PRIVATE" | "SECRET";
  avatarUrl: string;
  locationRestricted: boolean;
  allowMemberPosts: boolean;
  requirePostApproval: boolean;
}

interface CommunitySearchResult {
  id: number;
  type: "COMMUNITY";
  communityId?: number;
  communityName?: string;
  communitySlug?: string;
  communityDescription?: string;
  communityPrivacy?: string;
  communityMemberCount?: number;
  communityCategory?: string;
  communityIsMember?: boolean;
  communityIsOwner?: boolean;
}

interface JoinRequest {
  id: number;
  userId: number;
  username: string;
  profileImage: string | null;
  requestedAt: string;
  message?: string;
}

interface Member {
  userId: number;
  username: string;
  profileImage: string | null;
  role: "ADMIN" | "MODERATOR" | "MEMBER";
  joinedAt: string;
  isMuted?: boolean;
  isBanned?: boolean;
}

interface HealthInsight {
  healthScore?: number;
  healthTier?: string;
  memberCount?: number;
  postCount?: number;
  totalCommentCount?: number;
  activeMembers?: number;
  feedReach?: number;
  components?: Record<string, number>;
}

/* ── Invite types (mirrors CommunityInviteDto.java) ─────────────────────── */
interface InviteResponse {
  id: number;
  token: string;
  inviteLink: string;
  inviteeUsername: string | null;
  inviteeProfileImage: string | null;
  inviterUsername: string | null;
  message: string | null;
  status: "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";
  singleUse: boolean;
  useCount: number;
  createdAt: string;
  expiresAt: string;
  actionedAt: string | null;
}

interface InvitePreviewResponse {
  communityName: string;
  communitySlug: string;
  communityDescription: string | null;
  communityPrivacy: string;
  memberCount: number;
  inviterUsername: string | null;
  message: string | null;
  expiresAt: string;
  valid: boolean;
}

interface AcceptInviteResponse {
  communityId: number;
  communityName: string;
  communitySlug: string;
  joined: boolean;
  message: string;
}

interface UserSearchResult {
  id: number;
  username: string;
  profileImage: string | null;
  displayName?: string | null;
}

/* ─── constants ──────────────────────────────────────────────────────────── */
const CATS = [
  "LOCAL_GOVERNANCE","CIVIC_ISSUES","EDUCATION","HEALTH","ENVIRONMENT",
  "TECHNOLOGY","SPORTS","CULTURE","EMPLOYMENT","INFRASTRUCTURE","SAFETY","OTHER",
];
const CAT_ICON: Record<string, React.ReactNode> = {
  LOCAL_GOVERNANCE: <Building2 size={18} />,
  CIVIC_ISSUES:     <Construction size={18} />,
  EDUCATION:        <GraduationCap size={18} />,
  HEALTH:           <Stethoscope size={18} />,
  ENVIRONMENT:      <Leaf size={18} />,
  TECHNOLOGY:       <Laptop size={18} />,
  SPORTS:           <Trophy size={18} />,
  CULTURE:          <Palette size={18} />,
  EMPLOYMENT:       <Briefcase size={18} />,
  INFRASTRUCTURE:   <HardHat size={18} />,
  SAFETY:           <ShieldCheck size={18} />,
  OTHER:            <Globe size={18} />,
};
const PRIV_ICON: Record<string, React.ReactNode> = { 
  PUBLIC:  <Globe size={18} />, 
  PRIVATE: <Lock size={18} />, 
  SECRET:  <EyeOff size={18} /> 
};
const PRIV_DESC  = {
  PUBLIC:  "Anyone can join instantly",
  PRIVATE: "Requires moderator approval",
  SECRET:  "Invite only — not discoverable",
};

const Spin = ({ xs }: { xs?: boolean }) => (
  <span className={`loading loading-spinner ${xs ? "loading-xs" : "loading-sm"}`} />
);

function highlight(text: string, query: string): React.ReactNode {
  if (!query.trim() || !text) return text;
  const esc = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${esc})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className="bg-blue-700/25 text-blue-700 rounded px-0.5">{p}</mark>
      : p
  );
}

function avatar(name: string, image?: string | null) {
  if (image) return <img src={image} className="w-8 h-8 rounded-full object-cover" alt="" />;
  return (
    <div className="w-8 h-8 rounded-full overflow-hidden border border-base-300 bg-base-200 shrink-0">
      <img src={`https://robohash.org/${encodeURIComponent(name || "?")}`} alt="Avatar" className="w-full h-full object-cover" />
    </div>
  );
}

async function copyToClipboard(text: string, setCopied: (v: boolean) => void) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }
  setCopied(true);
  setTimeout(() => setCopied(false), 2200);
}

function relTime(iso?: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ════════════════════════════════════════════════════════════════════════════
   INVITE TAB — rendered inside AdminPanel for PRIVATE / SECRET communities
   Calls:
     POST   /api/communities/{id}/invites
     GET    /api/communities/{id}/invites?cursor=&limit=
     DELETE /api/communities/{id}/invites/{inviteId}
     GET    /api/users/search?q=&limit=
════════════════════════════════════════════════════════════════════════════ */
function InviteTab({
  communityId,
  privacy,
  communityName,
}: {
  communityId: number;
  privacy: "PRIVATE" | "SECRET";
  communityName: string;
}) {
  const isSecret = privacy === "SECRET";
  type Mode = "send" | "list";
  const [mode, setMode] = useState<Mode>("send");

  /* ── send-form state ─────────────────────────────────────────────────── */
  const [searchQ, setSearchQ]             = useState("");
  const [suggestions, setSuggestions]     = useState<UserSearchResult[]>([]);
  const [sugLoading, setSugLoading]       = useState(false);
  const [selectedUser, setSelectedUser]   = useState<UserSearchResult | null>(null);
  const [message, setMessage]             = useState("");
  const [sending, setSending]             = useState(false);
  const [sendResult, setSendResult]       = useState<InviteResponse | null>(null);
  const [sendError, setSendError]         = useState<string | null>(null);
  const [copiedSend, setCopiedSend]       = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── link-generate state ─────────────────────────────────────────────── */
  const [genLoading, setGenLoading]       = useState(false);
  const [genResult, setGenResult]         = useState<InviteResponse | null>(null);
  const [copiedGen, setCopiedGen]         = useState(false);

  /* ── pending invites list state ──────────────────────────────────────── */
  const [invites, setInvites]             = useState<InviteResponse[]>([]);
  const [listLoading, setListLoading]     = useState(false);
  const [hasMore, setHasMore]             = useState(false);
  const [cursor, setCursor]               = useState<number | null>(null);
  const [revoking, setRevoking]           = useState<number | null>(null);

  /* ── user typeahead ──────────────────────────────────────────────────── */
  useEffect(() => {
    if (debRef.current) clearTimeout(debRef.current);
    const q = searchQ.trim();
    if (q.length < 2 || selectedUser) { setSuggestions([]); return; }
    debRef.current = setTimeout(async () => {
      setSugLoading(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}&limit=5`, { headers: hdrs() });
        if (!res.ok) throw new Error();
        const d = await res.json();
        const list: UserSearchResult[] = d?.data ?? d?.content ?? d ?? [];
        setSuggestions(Array.isArray(list) ? list : []);
      } catch { setSuggestions([]); }
      finally { setSugLoading(false); }
    }, 280);
    return () => { if (debRef.current) clearTimeout(debRef.current); };
  }, [searchQ, selectedUser]);

  /* ── send targeted invite ────────────────────────────────────────────── */
  async function handleSendInvite() {
    if (!selectedUser) return;
    setSending(true); setSendError(null); setSendResult(null);
    try {
      const res = await fetch(`/api/communities/${communityId}/invites`, {
        method: "POST",
        headers: hdrs(),
        body: JSON.stringify({
          inviteeUsername: selectedUser.username,
          message: message.trim() || undefined,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setSendError(d?.message || `Error ${res.status}`); return; }
      const result: InviteResponse = d?.data ?? d;
      setSendResult(result);
      setSelectedUser(null); setSearchQ(""); setMessage(""); setSuggestions([]);
      if (mode === "list") loadInvites(null, true);
    } catch { setSendError("Network error. Please try again."); }
    finally { setSending(false); }
  }

  /* ── generate shareable link (no specific user) ──────────────────────── */
  async function handleGenerateLink() {
    setGenLoading(true); setGenResult(null);
    try {
      const res = await fetch(`/api/communities/${communityId}/invites`, {
        method: "POST",
        headers: hdrs(),
        body: JSON.stringify({}),          // no inviteeUsername → multi-use link
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d?.message || "Could not generate link."); return; }
      setGenResult(d?.data ?? d);
    } catch { alert("Network error."); }
    finally { setGenLoading(false); }
  }

  /* ── load pending invites ────────────────────────────────────────────── */
  const loadInvites = useCallback(async (cur: number | null, replace: boolean) => {
    setListLoading(true);
    try {
      const p = new URLSearchParams({ limit: "20" });
      if (cur) p.set("cursor", String(cur));
      const res = await fetch(`/api/communities/${communityId}/invites?${p}`, { headers: hdrs() });
      if (!res.ok) throw new Error();
      const d = await res.json();
      const paged = d?.data ?? d;
      const rows: InviteResponse[] = paged?.content ?? [];
      setInvites(prev => replace ? rows : [...prev, ...rows]);
      setHasMore(paged?.hasMore ?? false);
      setCursor(paged?.nextCursor ?? null);
    } catch { if (replace) setInvites([]); }
    finally { setListLoading(false); }
  }, [communityId]);

  useEffect(() => {
    if (mode === "list") loadInvites(null, true);
  }, [mode, loadInvites]);

  /* ── revoke ──────────────────────────────────────────────────────────── */
  async function handleRevoke(inviteId: number) {
    if (!window.confirm("Revoke this invite?")) return;
    setRevoking(inviteId);
    try {
      const res = await fetch(`/api/communities/${communityId}/invites/${inviteId}`, {
        method: "DELETE", headers: hdrs(),
      });
      if (!res.ok) { alert("Could not revoke."); return; }
      setInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch { alert("Network error."); }
    finally { setRevoking(null); }
  }

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <div className="p-4 space-y-4">

      {/* Context banner */}
      <div className={`rounded-xl border px-4 py-3 text-sm flex items-start gap-3 ${
        isSecret
          ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
          : "bg-orange-500/10 border-orange-500/30 text-orange-400"
      }`}>
        <span className="text-xl shrink-0 mt-0.5">{isSecret ? <EyeOff size={20} /> : <Lock size={20} />}</span>
        <div>
          <p className="font-semibold">{isSecret ? "Secret Community" : "Private Community"}</p>
          <p className="opacity-70 text-xs mt-0.5">
            {isSecret
              ? "Invites are the only way to join this community."
              : "Invited users skip the approval queue and join instantly."}
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-base-200 rounded-xl p-1">
        {(["send", "list"] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 btn btn-xs rounded-lg transition-all ${mode === m ? "bg-blue-700 text-white font-semibold border-none hover:bg-blue-800" : "btn-ghost"}`}
          >
            {m === "send" ? <><Mail size={12} className="mr-1" /> Send Invite</> : <><ClipboardCheck size={12} className="mr-1" /> Pending Invites</>}
          </button>
        ))}
      </div>

      {/* ── SEND MODE ── */}
      {mode === "send" && (
        <div className="space-y-4">

          {/* Success */}
          {sendResult && (
            <div className="rounded-xl border border-success/30 bg-success/10 p-4 space-y-3">
              <div className="flex items-center gap-2 text-success font-semibold text-sm">
                <CheckCircle2 size={16} />
                Invite sent to @{sendResult.inviteeUsername ?? "user"}!
              </div>
              {sendResult.inviteLink && (
                <div className="space-y-1.5">
                  <p className="text-xs opacity-60">Share this link:</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-base-300 rounded-lg px-3 py-2 truncate block">
                      {sendResult.inviteLink}
                    </code>
                    <button
                      className={`btn btn-xs shrink-0 ${copiedSend ? "btn-success" : "btn-outline"}`}
                      onClick={() => copyToClipboard(sendResult.inviteLink, setCopiedSend)}
                    >
                      {copiedSend ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  {sendResult.expiresAt && (
                    <p className="text-xs opacity-40">
                      Expires: {new Date(sendResult.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  )}
                </div>
              )}
              <button className="btn btn-ghost btn-xs w-full" onClick={() => setSendResult(null)}>
                Send another invite
              </button>
            </div>
          )}

          {/* Error */}
          {sendError && (
            <div className="bg-error/10 border border-error/30 text-error text-sm rounded-xl px-4 py-2">
              ⚠️ {sendError}
            </div>
          )}

          {!sendResult && (
            <>
              {/* Username search */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Invite by username <span className="text-error">*</span>
                </label>

                {selectedUser ? (
                  <div className="flex items-center gap-3 rounded-xl border border-blue-700 bg-blue-700/10 p-3">
                    {avatar(selectedUser.username, selectedUser.profileImage)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold">@{selectedUser.username}</p>
                      {selectedUser.displayName && selectedUser.displayName !== selectedUser.username && (
                        <p className="text-xs opacity-60">{selectedUser.displayName}</p>
                      )}
                    </div>
                    <button
                      className="btn btn-ghost btn-xs btn-circle text-error"
                      onClick={() => { setSelectedUser(null); setSearchQ(""); }}
                    ><X size={14} /></button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={14} />
                      <input
                        type="text"
                        placeholder="Search username…"
                        className="input input-bordered w-full pl-8"
                        value={searchQ}
                        onChange={e => setSearchQ(e.target.value)}
                        autoComplete="off"
                      />
                      {sugLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2"><Spin xs /></div>
                      )}
                    </div>

                    {suggestions.length > 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-base-100 border border-base-300 rounded-xl shadow-xl overflow-hidden">
                        {suggestions.map(u => (
                          <button
                            key={u.id}
                            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 text-left transition-colors"
                            onMouseDown={e => { e.preventDefault(); setSelectedUser(u); setSearchQ(""); setSuggestions([]); }}
                          >
                            {avatar(u.username, u.profileImage)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">@{u.username}</p>
                              {u.displayName && u.displayName !== u.username && (
                                <p className="text-xs opacity-50 truncate">{u.displayName}</p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {searchQ.trim().length >= 2 && !sugLoading && suggestions.length === 0 && (
                      <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-base-100 border border-base-300 rounded-xl shadow-xl p-4 text-center text-sm opacity-50">
                        No users found for "{searchQ}"
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Optional message */}
              <div>
                <label className="block text-sm font-semibold mb-1.5">
                  Personal message <span className="opacity-40 font-normal">(optional)</span>
                </label>
                <textarea
                  className="textarea textarea-bordered w-full resize-none text-sm"
                  rows={2}
                  placeholder={`Hey! Join ${communityName}…`}
                  maxLength={300}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                />
                <p className="text-xs opacity-40 mt-1">{message.length}/300</p>
              </div>

              <button
                className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 w-full gap-2"
                disabled={!selectedUser || sending}
                onClick={handleSendInvite}
              >
                {sending ? <><Spin xs /> Sending…</> : "📨 Send Invite"}
              </button>

              <div className="divider text-xs opacity-40 my-1">OR</div>

              {/* Shareable link generator */}
              <div className="rounded-xl border border-base-300 bg-base-200 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="text-xl text-blue-700"><Link size={20} /></span>
                  <div>
                    <p className="text-sm font-semibold">Generate Shareable Link</p>
                    <p className="text-xs opacity-60 mt-0.5">
                      Anyone with this link can join until it expires (7 days).
                    </p>
                  </div>
                </div>

                {genResult?.inviteLink ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-base-100 rounded-lg px-3 py-2 truncate block border border-base-300">
                        {genResult.inviteLink}
                      </code>
                      <button
                        className={`btn btn-xs shrink-0 ${copiedGen ? "btn-success" : "bg-blue-700 text-white font-semibold border-none hover:bg-blue-800"}`}
                        onClick={() => copyToClipboard(genResult!.inviteLink, setCopiedGen)}
                      >
                        {copiedGen ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    {genResult.expiresAt && (
                      <p className="text-xs opacity-40">
                        Expires {new Date(genResult.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Join "${communityName}" on JanSahayak: ${genResult.inviteLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-success btn-sm w-full gap-2"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347"/>
                      </svg>
                      Share via WhatsApp
                    </a>
                    <button className="btn btn-ghost btn-xs w-full" onClick={() => setGenResult(null)}>
                      Generate new link
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-outline btn-sm w-full gap-2"
                    disabled={genLoading}
                    onClick={handleGenerateLink}
                  >
                    {genLoading ? <><Spin xs /> Generating…</> : "🔗 Generate Invite Link"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── LIST MODE ── */}
      {mode === "list" && (
        <div className="space-y-3">
          {listLoading && invites.length === 0 && (
            <div className="flex justify-center py-10"><Spin /></div>
          )}
          {!listLoading && invites.length === 0 && (
            <div className="text-center py-12 opacity-50 space-y-2">
              <div className="flex justify-center mb-2"><Inbox size={40} /></div>
              <p className="font-medium text-sm">No pending invites</p>
              <p className="text-xs">Switch to "Send Invite" to invite someone.</p>
            </div>
          )}
          {invites.map(inv => (
            <InviteRow
              key={inv.id}
              invite={inv}
              revoking={revoking === inv.id}
              onRevoke={() => handleRevoke(inv.id)}
            />
          ))}
          {hasMore && !listLoading && (
            <button
              className="w-full py-2 text-sm text-blue-700 hover:opacity-70"
              onClick={() => loadInvites(cursor, false)}
            >
              Load more ↓
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Single invite row in the pending list ───────────────────────────────── */
function InviteRow({
  invite,
  revoking,
  onRevoke,
}: {
  invite: InviteResponse;
  revoking: boolean;
  onRevoke: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const statusColor: Record<InviteResponse["status"], string> = {
    PENDING:  "badge-warning",
    ACCEPTED: "badge-success",
    EXPIRED:  "badge-ghost",
    REVOKED:  "badge-error",
  };

  return (
    <div className="rounded-xl border border-base-300 bg-base-200 p-3 space-y-2">
      <div className="flex items-center gap-3">
        {avatar(invite.inviteeUsername ?? "🔗", invite.inviteeProfileImage)}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-semibold">
              {invite.inviteeUsername ? `@${invite.inviteeUsername}` : "🔗 Link invite"}
            </p>
            <span className={`badge badge-xs ${statusColor[invite.status]}`}>
              {invite.status.toLowerCase()}
            </span>
            {!invite.singleUse && (
              <span className="badge badge-xs badge-ghost">multi-use</span>
            )}
            {invite.useCount > 0 && (
              <span className="badge badge-xs badge-ghost">{invite.useCount}× used</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs opacity-40 mt-0.5">
            <span>Sent {relTime(invite.createdAt)}</span>
            {invite.expiresAt && (
              <span>· Expires {new Date(invite.expiresAt).toLocaleDateString("en-IN", { day:"numeric", month:"short" })}</span>
            )}
          </div>
        </div>
        {invite.status === "PENDING" && (
          <button
            className="btn btn-ghost btn-xs text-error shrink-0"
            disabled={revoking}
            onClick={onRevoke}
          >
            {revoking ? <Spin xs /> : "Revoke"}
          </button>
        )}
      </div>

      {invite.inviteLink && invite.status === "PENDING" && (
        <div className="flex items-center gap-2">
          <code className="flex-1 text-xs bg-base-100 rounded-lg px-2 py-1.5 truncate border border-base-300">
            {invite.inviteLink}
          </code>
          <button
            className={`btn btn-xs shrink-0 ${copied ? "btn-success" : "btn-outline"}`}
            onClick={() => copyToClipboard(invite.inviteLink, setCopied)}
          >
            {copied ? "✓" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ACCEPT INVITE PAGE — standalone page, rendered at /invite/:token
   Calls:
     GET  /api/communities/invites/preview/{token}   (public, no auth)
     POST /api/communities/invites/accept/{token}    (requires auth)
════════════════════════════════════════════════════════════════════════════ */
export function AcceptInvitePage() {
  // Read :token from react-router URL param  /invite/:token
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();

  type PageStatus = "idle" | "loading" | "success" | "already" | "error";
  const [status, setStatus]               = useState<PageStatus>("idle");
  const [preview, setPreview]             = useState<InvitePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [errorMsg, setErrorMsg]           = useState("");
  const [accepted, setAccepted]           = useState<AcceptInviteResponse | null>(null);

  /* ── Load preview (public — no auth needed) ── */
  useEffect(() => {
    if (!token) { setPreviewLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`/api/communities/invites/preview/${token}`);
        if (res.status === 404) {
          setErrorMsg("This invite link is invalid or has expired.");
          return;
        }
        if (!res.ok) throw new Error();
        const d = await res.json();
        const p: InvitePreviewResponse = d?.data ?? d;
        setPreview(p);
        if (!p.valid) setErrorMsg("This invite link has expired or been revoked.");
      } catch { setErrorMsg("Could not load invite details."); }
      finally { setPreviewLoading(false); }
    })();
  }, [token]);

  /* ── Accept invite (requires auth) ── */
  async function handleAccept() {
    if (!getToken()) {
      // Not logged in — redirect to login with return path
      navigate(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
      return;
    }
    setStatus("loading");
    try {
      const res = await fetch(`/api/communities/invites/accept/${token}`, {
        method: "POST",
        headers: hdrs(),
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(d?.message || "Could not accept invite.");
        setStatus("error");
        return;
      }
      const result: AcceptInviteResponse = d?.data ?? d;
      setAccepted(result);
      // "already a member" message from backend → treat as success for redirect
      setStatus(result.message?.toLowerCase().includes("already") ? "already" : "success");
    } catch {
      setErrorMsg("Network error. Please try again.");
      setStatus("error");
    }
  }

  return (
    <div className="min-h-screen bg-base-200 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-base-100 rounded-3xl border border-base-300 shadow-2xl overflow-hidden">

        {/* Gradient header */}
        <div className="h-24 bg-gradient-to-br from-primary/30 via-primary/10 to-base-200 flex items-center justify-center">
          <Home size={48} className="text-blue-700" />
        </div>

        <div className="px-6 pb-6 pt-4 space-y-4">

          {/* Loading preview */}
          {previewLoading && (
            <div className="flex justify-center py-8"><Spin /></div>
          )}

          {/* Invalid / expired before any action */}
          {!previewLoading && errorMsg && status === "idle" && (
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center text-error"><XCircle size={40} /></div>
              <p className="font-semibold">{errorMsg}</p>
              <p className="text-xs opacity-50">Ask the community admin for a fresh invite.</p>
            </div>
          )}

          {/* Valid preview — ready to accept */}
          {!previewLoading && preview && preview.valid && status === "idle" && (
            <>
              <div className="text-center space-y-1">
                <h1 className="text-xl font-bold">{preview.communityName}</h1>
                {preview.communityDescription && (
                  <p className="text-sm opacity-60 line-clamp-3">{preview.communityDescription}</p>
                )}
                <div className="flex items-center justify-center gap-3 text-xs opacity-50 pt-1">
                  <span className="flex items-center gap-1"><Users size={12} /> {(preview.memberCount ?? 0).toLocaleString()} members</span>
                  <span>·</span>
                  <span className="flex items-center gap-1">{preview.communityPrivacy === "SECRET" ? <><EyeOff size={12} /> Secret</> : <><Lock size={12} /> Private</>}</span>
                </div>
              </div>

              {preview.inviterUsername && (
                <div className="rounded-xl bg-base-200 px-4 py-3 text-sm text-center">
                  <span className="opacity-60">Invited by </span>
                  <span className="font-semibold">@{preview.inviterUsername}</span>
                </div>
              )}

              {preview.message && (
                <div className="rounded-xl border border-base-300 bg-base-200 px-4 py-3 text-sm italic opacity-80">
                  "{preview.message}"
                </div>
              )}

              {preview.expiresAt && (
                <p className="text-xs text-center opacity-40">
                  Invite expires:{" "}
                  {new Date(preview.expiresAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              )}

              {!getToken() && (
                <div className="rounded-xl bg-warning/10 border border-warning/30 px-3 py-2 text-xs text-warning text-center">
                  You need to log in first to accept this invite.
                </div>
              )}

              <button
                className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 w-full"
                onClick={handleAccept}
              >
                <Rocket size={18} className="mr-2" /> Accept &amp; Join Community
              </button>

              <p className="text-xs text-center opacity-40">
                By joining, you agree to follow the community's rules.
              </p>
            </>
          )}

          {/* Accepting spinner */}
          {status === "loading" && (
            <div className="text-center space-y-3 py-6">
              <Spin />
              <p className="text-sm opacity-60">Joining community…</p>
            </div>
          )}

          {/* Success */}
          {(status === "success" || status === "already") && accepted && (
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center text-blue-700"><PartyPopper size={48} /></div>
              <h2 className="font-bold text-lg">
                {status === "already" ? "Already a member!" : "You're in!"}
              </h2>
              <p className="text-sm opacity-60">
                Welcome to <strong>{accepted.communityName}</strong>.
              </p>
              <button
                className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 w-full"
                onClick={() => navigate('/communities')}
              >
                Open Community <ChevronLeft size={16} className="rotate-180 ml-1" />
              </button>
            </div>
          )}

          {/* Error after attempting accept */}
          {status === "error" && (
            <div className="text-center space-y-3 py-4">
              <div className="flex justify-center text-error"><AlertTriangle size={40} /></div>
              <p className="font-semibold text-error">{errorMsg}</p>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => { setStatus("idle"); setErrorMsg(""); }}
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ADMIN PANEL
════════════════════════════════════════════════════════════════════════════ */
// AdminTab now includes "invites" — shown only for PRIVATE and SECRET communities
type AdminTab = "requests" | "members" | "settings" | "insights" | "invites";

function AdminPanel({
  community,
  onClose,
  onCommunityUpdated,
}: {
  community: CommunityData;
  onClose: () => void;
  onCommunityUpdated: (c: CommunityData) => void;
}) {
  const [tab, setTab] = useState<AdminTab>("requests");
  const [c, setC]     = useState(community);

  /* ── join requests ── */
  const [requests, setRequests]       = useState<JoinRequest[]>([]);
  const [reqLoading, setReqLoading]   = useState(false);
  const [reqCursor, setReqCursor]     = useState<number | null>(null);
  const [reqHasMore, setReqHasMore]   = useState(false);
  const [actingReq, setActingReq]     = useState<number | null>(null);

  const loadRequests = useCallback(async (cur: number | null, replace: boolean) => {
    setReqLoading(true);
    try {
      const p = new URLSearchParams({ limit: "20" });
      if (cur) p.set("cursor", String(cur));
      const res = await fetch(`/api/communities/${c.id}/join-requests?${p}`, { headers: hdrs() });
      if (!res.ok) throw new Error();
      const d = await res.json();
      const paged = d?.data ?? d;
      const rows: JoinRequest[] = paged.content ?? [];
      setRequests(prev => replace ? rows : [...prev, ...rows]);
      setReqHasMore(paged.hasMore ?? false);
      setReqCursor(paged.nextCursor ?? null);
    } catch { if (replace) setRequests([]); }
    finally { setReqLoading(false); }
  }, [c.id]);

  async function reviewRequest(reqId: number, approve: boolean) {
    setActingReq(reqId);
    try {
      const res = await fetch(`/api/communities/${c.id}/join-requests/${reqId}`, {
        method: "PUT", headers: hdrs(),
        body: JSON.stringify({ approve }),
      });
      if (!res.ok) { alert("Action failed."); return; }
      setRequests(p => p.filter(r => r.id !== reqId));
      if (approve) setC(p => ({ ...p, memberCount: p.memberCount + 1 }));
    } catch { alert("Network error."); }
    finally { setActingReq(null); }
  }

  /* ── members ── */
  const [members, setMembers]         = useState<Member[]>([]);
  const [memLoading, setMemLoading]   = useState(false);
  const [memCursor, setMemCursor]     = useState<number | null>(null);
  const [memHasMore, setMemHasMore]   = useState(false);
  const [actingMem, setActingMem]     = useState<number | null>(null);
  const [memSearch, setMemSearch]     = useState("");

  const loadMembers = useCallback(async (cur: number | null, replace: boolean) => {
    setMemLoading(true);
    try {
      const p = new URLSearchParams({ limit: "30" });
      if (cur) p.set("cursor", String(cur));
      const res = await fetch(`/api/communities/${c.id}/members?${p}`, { headers: hdrs() });
      if (!res.ok) throw new Error();
      const d = await res.json();
      const paged = d?.data ?? d;
      const rows: Member[] = paged.content ?? [];
      setMembers(prev => replace ? rows : [...prev, ...rows]);
      setMemHasMore(paged.hasMore ?? false);
      setMemCursor(paged.nextCursor ?? null);
    } catch { if (replace) setMembers([]); }
    finally { setMemLoading(false); }
  }, [c.id]);

  async function memberAction(
    userId: number,
    action: "remove" | "mute" | "unmute" | "ban" | "unban" | "makeAdmin" | "makeMod" | "makeMember"
  ) {
    setActingMem(userId);
    try {
      let res: Response;
      if (action === "remove") {
        if (!confirm("Remove this member from the community?")) return;
        res = await fetch(`/api/communities/${c.id}/members/${userId}`, { method: "DELETE", headers: hdrs() });
      } else if (action === "mute") {
        res = await fetch(`/api/communities/${c.id}/members/${userId}/mute`, { method: "PUT", headers: hdrs() });
      } else if (action === "unmute") {
        res = await fetch(`/api/communities/${c.id}/members/${userId}/mute`, { method: "DELETE", headers: hdrs() });
      } else if (action === "ban") {
        if (!confirm("Ban this member?")) return;
        res = await fetch(`/api/communities/${c.id}/members/${userId}/ban`, { method: "PUT", headers: hdrs(), body: JSON.stringify({}) });
      } else if (action === "unban") {
        res = await fetch(`/api/communities/${c.id}/members/${userId}/ban`, { method: "DELETE", headers: hdrs() });
      } else {
        const roleMap = { makeAdmin: "ADMIN", makeMod: "MODERATOR", makeMember: "MEMBER" };
        res = await fetch(`/api/communities/${c.id}/members/${userId}/role`, {
          method: "PUT", headers: hdrs(),
          body: JSON.stringify({ role: roleMap[action as keyof typeof roleMap] }),
        });
      }
      if (!res.ok) { alert("Action failed."); return; }
      if (action === "remove" || action === "ban") {
        setMembers(p => p.filter(m => m.userId !== userId));
        if (action === "remove") setC(p => ({ ...p, memberCount: Math.max(0, p.memberCount - 1) }));
      } else {
        setMembers(p => p.map(m => {
          if (m.userId !== userId) return m;
          if (action === "mute")       return { ...m, isMuted: true };
          if (action === "unmute")     return { ...m, isMuted: false };
          if (action === "unban")      return { ...m, isBanned: false };
          if (action === "makeAdmin")  return { ...m, role: "ADMIN" as const };
          if (action === "makeMod")    return { ...m, role: "MODERATOR" as const };
          if (action === "makeMember") return { ...m, role: "MEMBER" as const };
          return m;
        }));
      }
    } catch { alert("Network error."); }
    finally { setActingMem(null); }
  }

  /* ── settings ── */
  const [settingsForm, setSettingsForm] = useState({
    name:                c.name,
    description:         c.description,
    privacy:             c.privacy,
    avatarUrl:           c.avatarUrl || "",
    allowMemberPosts:    c.allowMemberPosts    ?? true,
    requirePostApproval: c.requirePostApproval ?? false,
    feedEligible:        c.feedEligible        ?? false,
  });
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [settingsMsg,  setSettingsMsg]  = useState<string | null>(null);
  const [archiveBusy,  setArchiveBusy]  = useState(false);

  async function saveSettings() {
    setSettingsBusy(true); setSettingsMsg(null);
    try {
      const res = await fetch(`/api/communities/${c.id}`, {
        method: "PUT", headers: hdrs(), body: JSON.stringify(settingsForm),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); setSettingsMsg("❌ " + (d?.message || "Save failed.")); return; }
      const d   = await res.json();
      const raw = d?.data ?? d;
      const updated: CommunityData = { ...c, ...raw, isOwner: true, isMember: true };
      setC(updated); onCommunityUpdated(updated);
      setSettingsMsg("✅ Saved successfully.");
    } catch { setSettingsMsg("❌ Network error."); }
    finally { setSettingsBusy(false); }
  }

  async function archiveCommunity() {
    if (!confirm(`Archive "${c.name}"? This cannot be undone easily.`)) return;
    setArchiveBusy(true);
    try {
      const res = await fetch(`/api/communities/${c.id}/archive`, { method: "DELETE", headers: hdrs() });
      if (!res.ok) { alert("Archive failed."); return; }
      alert("Community archived."); onClose();
    } catch { alert("Network error."); }
    finally { setArchiveBusy(false); }
  }

  /* ── health insights ── */
  const [insights, setInsights]             = useState<HealthInsight | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [recalcBusy, setRecalcBusy]         = useState(false);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/communities/${c.id}/insights`, { headers: hdrs() });
      if (!res.ok) throw new Error();
      const d = await res.json();
      setInsights(d?.data ?? d);
    } catch { setInsights(null); }
    finally { setInsightsLoading(false); }
  }, [c.id]);

  async function triggerRecalc() {
    setRecalcBusy(true);
    try {
      await fetch(`/api/communities/${c.id}/health/recalculate`, { method: "POST", headers: hdrs() });
      setTimeout(() => loadInsights(), 1500);
    } catch { /* silent */ }
    finally { setRecalcBusy(false); }
  }

  /* ── tab load trigger ── */
  useEffect(() => {
    if (tab === "requests") loadRequests(null, true);
    if (tab === "members")  loadMembers(null, true);
    if (tab === "insights") loadInsights();
    // "invites" and "settings" load their own data internally
  }, [tab]);

  const filteredMembers = memSearch.trim()
    ? members.filter(m => m.username.toLowerCase().includes(memSearch.toLowerCase()))
    : members;

  // Build tab list — invites only shown for PRIVATE and SECRET
  const TABS: { key: AdminTab; label: string; icon: React.ReactNode; badge?: number }[] = [
    { key: "requests", label: "Requests", icon: <Inbox size={14} />, badge: requests.length > 0 ? requests.length : undefined },
    { key: "members",  label: "Members",  icon: <Users size={14} /> },
    ...(c.privacy !== "PUBLIC"
      ? [{ key: "invites" as AdminTab, label: "Invites", icon: <Link size={14} /> }]
      : []
    ),
    { key: "settings", label: "Settings", icon: <Settings size={14} /> },
    { key: "insights", label: "Insights", icon: <BarChart3 size={14} /> },
  ];

  const roleColor = (role: Member["role"]) => {
    if (role === "ADMIN")     return "badge-error";
    if (role === "MODERATOR") return "badge-warning";
    return "badge-ghost";
  };

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative ml-auto w-full max-w-lg h-full bg-base-100 flex flex-col shadow-2xl"
        style={{ animation: "slideR .22s ease-out" }}
        onClick={e => e.stopPropagation()}
      >
        <style>{`@keyframes slideR{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

        {/* Header */}
        <div className="shrink-0 px-4 py-3 border-b border-base-300 bg-base-100">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="flex items-center gap-2">
                <Settings size={18} className="text-base-content/70" />
                <h2 className="font-bold text-base truncate max-w-[220px]">{c.name}</h2>
                <span className="badge badge-warning badge-xs">Admin</span>
              </div>
              <p className="text-xs opacity-50 mt-0.5">
                {c.memberCount} members · {c.privacy.toLowerCase()} community
              </p>
            </div>
            <button onClick={onClose} className="btn btn-ghost btn-sm btn-circle"><X size={18} /></button>
          </div>
          <div className="flex gap-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`relative flex-1 btn btn-xs rounded-lg gap-1 transition-all ${
                  tab === t.key ? "bg-blue-700 text-white font-semibold border-none hover:bg-blue-800" : "btn-ghost opacity-60 hover:opacity-100"
                }`}
              >
                <span>{t.icon}</span>
                <span className="hidden sm:inline">{t.label}</span>
                {t.badge && (
                  <span className="absolute -top-1 -right-1 bg-error text-error-content text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {t.badge > 9 ? "9+" : t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* ── JOIN REQUESTS ── */}
          {tab === "requests" && (
            <div className="p-4 space-y-3">
              {reqLoading && requests.length === 0 && <div className="flex justify-center py-10"><Spin /></div>}
              {!reqLoading && requests.length === 0 && (
                <div className="text-center py-14 opacity-50 space-y-2">
                  <div className="flex justify-center text-success mb-2"><CheckCircle2 size={40} /></div>
                  <p className="font-medium">No pending requests</p>
                  <p className="text-xs">
                    {c.privacy === "PUBLIC" ? "Public community — members join instantly." : "All caught up!"}
                  </p>
                </div>
              )}
              {requests.map(req => (
                <div key={req.id} className="rounded-xl border border-base-300 bg-base-200 p-3 flex items-start gap-3">
                  {avatar(req.username, req.profileImage)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">@{req.username}</p>
                    {req.message && <p className="text-xs opacity-60 mt-0.5 line-clamp-2">"{req.message}"</p>}
                    <p className="text-xs opacity-40 mt-0.5">
                      {new Date(req.requestedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button className="btn btn-success btn-xs gap-1" disabled={actingReq === req.id} onClick={() => reviewRequest(req.id, true)}>
                      {actingReq === req.id ? <Spin xs /> : "✓ Accept"}
                    </button>
                    <button className="btn btn-ghost btn-xs btn-outline gap-1" disabled={actingReq === req.id} onClick={() => reviewRequest(req.id, false)}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
              {reqHasMore && !reqLoading && (
                <button className="w-full py-2 text-sm text-blue-700" onClick={() => loadRequests(reqCursor, false)}>
                  Load more ↓
                </button>
              )}
            </div>
          )}

          {/* ── MEMBERS ── */}
          {tab === "members" && (
            <div className="p-4 space-y-3">
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={14} />
                <input type="text" placeholder="Filter members…" className="input input-bordered input-sm w-full pl-8"
                  value={memSearch} onChange={e => setMemSearch(e.target.value)} />
              </div>
              {memLoading && members.length === 0 && <div className="flex justify-center py-10"><Spin /></div>}
              {!memLoading && members.length === 0 && <div className="text-center py-10 opacity-50"><p>No members found.</p></div>}
              {filteredMembers.map(m => (
                <div key={m.userId} className="rounded-xl border border-base-300 bg-base-200 p-3">
                  <div className="flex items-center gap-3">
                    {avatar(m.username, m.profileImage)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold">@{m.username}</p>
                        <span className={`badge badge-xs ${roleColor(m.role)}`}>{m.role}</span>
                        {m.isMuted  && <span className="badge badge-xs badge-warning flex items-center gap-1"><VolumeX size={10} /> Muted</span>}
                        {m.isBanned && <span className="badge badge-xs badge-error flex items-center gap-1"><Ban size={10} /> Banned</span>}
                      </div>
                      <p className="text-xs opacity-40">
                        Joined {new Date(m.joinedAt).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="dropdown dropdown-end">
                      <button tabIndex={0} className="btn btn-ghost btn-xs btn-circle" disabled={actingMem === m.userId}>
                        {actingMem === m.userId ? <Spin xs /> : "⋯"}
                      </button>
                      <ul tabIndex={0} className="dropdown-content menu menu-sm bg-base-100 rounded-xl border border-base-300 shadow-lg z-50 w-44 p-1">
                        {m.role !== "ADMIN"     && <li><button onClick={() => memberAction(m.userId, "makeAdmin")}><Crown size={14} /> Make Admin</button></li>}
                        {m.role !== "MODERATOR" && <li><button onClick={() => memberAction(m.userId, "makeMod")}><Shield size={14} /> Make Moderator</button></li>}
                        {m.role !== "MEMBER"    && <li><button onClick={() => memberAction(m.userId, "makeMember")}><User size={14} /> Make Member</button></li>}
                        <li className="menu-title"><span className="text-xs opacity-40">Actions</span></li>
                        {!m.isMuted
                          ? <li><button onClick={() => memberAction(m.userId, "mute")}><VolumeX size={14} /> Mute</button></li>
                          : <li><button onClick={() => memberAction(m.userId, "unmute")}><Volume2 size={14} /> Unmute</button></li>}
                        {!m.isBanned
                          ? <li><button className="text-error" onClick={() => memberAction(m.userId, "ban")}><Ban size={14} /> Ban</button></li>
                          : <li><button onClick={() => memberAction(m.userId, "unban")}><CheckCircle2 size={14} /> Unban</button></li>}
                        <li><button className="text-error" onClick={() => memberAction(m.userId, "remove")}><Trash2 size={14} /> Remove</button></li>
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
              {memHasMore && !memLoading && (
                <button className="w-full py-2 text-sm text-blue-700" onClick={() => loadMembers(memCursor, false)}>
                  Load more ↓
                </button>
              )}
            </div>
          )}

          {/* ── INVITES ── (new tab — only for PRIVATE / SECRET) */}
          {tab === "invites" && c.privacy !== "PUBLIC" && (
            <InviteTab
              communityId={c.id}
              privacy={c.privacy as "PRIVATE" | "SECRET"}
              communityName={c.name}
            />
          )}

          {/* ── SETTINGS ── */}
          {tab === "settings" && (
            <div className="p-4 space-y-4">
              {settingsMsg && (
                <div className={`text-sm rounded-xl px-4 py-2 border ${settingsMsg.startsWith("✅") ? "bg-success/10 border-success/30 text-success" : "bg-error/10 border-error/30 text-error"}`}>
                  {settingsMsg}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold mb-1">Community Name</label>
                <input className="input input-bordered w-full" maxLength={60}
                  value={settingsForm.name}
                  onChange={e => setSettingsForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Image URL</label>
                <input className="input input-bordered w-full" placeholder="https://..."
                  value={settingsForm.avatarUrl}
                  onChange={e => setSettingsForm(f => ({ ...f, avatarUrl: e.target.value }))} />
                <p className="text-xs opacity-40 mt-1">Leave blank to use an auto-generated robot avatar.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description</label>
                <textarea className="textarea textarea-bordered w-full resize-none" rows={3} maxLength={500}
                  value={settingsForm.description}
                  onChange={e => setSettingsForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Privacy</label>
                <div className="space-y-2">
                  {(["PUBLIC","PRIVATE","SECRET"] as const).map(p => (
                    <button key={p} type="button"
                      onClick={() => setSettingsForm(f => ({ ...f, privacy: p }))}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${settingsForm.privacy === p ? "border-blue-700 bg-blue-700/10" : "border-base-300 hover:border-base-400"}`}>
                      <span className="text-xl">{PRIV_ICON[p]}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${settingsForm.privacy === p ? "text-blue-700" : ""}`}>
                          {p.charAt(0)+p.slice(1).toLowerCase()}
                        </p>
                        <p className="text-xs opacity-50">{PRIV_DESC[p]}</p>
                      </div>
                      {settingsForm.privacy === p && <span className="text-blue-700">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold">Permissions</label>
                {[
                  { key: "allowMemberPosts",    label: "Members can post",        desc: "Any member can create posts" },
                  { key: "requirePostApproval", label: "Require post approval",   desc: "Posts need moderator approval" },
                  { key: "feedEligible",        label: "Show posts in main feed", desc: "High-engagement posts surface in the main feed" },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-base-300 p-3 cursor-pointer hover:border-base-400">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs opacity-50">{desc}</p>
                    </div>
                    <input type="checkbox" className="toggle toggle-primary toggle-sm"
                      checked={settingsForm[key as keyof typeof settingsForm] as boolean}
                      onChange={e => setSettingsForm(f => ({ ...f, [key]: e.target.checked }))} />
                  </label>
                ))}
              </div>
              <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 w-full" disabled={settingsBusy} onClick={saveSettings}>
                {settingsBusy ? <><Spin xs /> Saving…</> : <><Save size={18} className="mr-2" /> Save Changes</>}
              </button>
              <div className="rounded-xl border border-error/30 bg-error/5 p-4 space-y-2 mt-4">
                <p className="text-sm font-semibold text-error flex items-center gap-2"><AlertTriangle size={16} /> Danger Zone</p>
                <p className="text-xs opacity-60">Archiving removes the community from discovery and disables new posts.</p>
                <button className="btn btn-error btn-outline btn-sm w-full" disabled={archiveBusy} onClick={archiveCommunity}>
                  {archiveBusy ? <Spin xs /> : <><Archive size={16} className="mr-2" /> Archive Community</>}
                </button>
              </div>
            </div>
          )}

          {/* ── HEALTH INSIGHTS ── */}
          {tab === "insights" && (
            <div className="p-4 space-y-4">
              {insightsLoading && <div className="flex justify-center py-10"><Spin /></div>}
              {!insightsLoading && !insights && (
                <div className="text-center py-10 opacity-50 space-y-2">
                  <div className="text-4xl">📊</div>
                  <p className="text-sm">Could not load insights.</p>
                  <button className="btn btn-sm btn-outline !opacity-100" onClick={loadInsights}>Retry</button>
                </div>
              )}
              {!insightsLoading && insights && (
                <>
                  <div className="rounded-2xl border border-base-300 bg-gradient-to-br from-primary/10 to-base-200 p-5 text-center">
                    <p className="text-xs opacity-50 uppercase tracking-widest mb-1">Health Score</p>
                    <p className="text-5xl font-black text-blue-700">
                      {insights.healthScore != null ? Math.round(insights.healthScore) : "—"}
                    </p>
                    {insights.healthTier && <p className="text-sm font-semibold mt-1 opacity-70">{insights.healthTier}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      ["👥 Members", insights.memberCount],
                      ["📝 Posts",   insights.postCount],
                      ["💬 Comments", insights.totalCommentCount],
                      ["🔥 Active",  insights.activeMembers],
                      ["📡 Feed Reach", insights.feedReach],
                    ].filter(([, v]) => v != null).map(([label, value]) => (
                      <div key={String(label)} className="rounded-xl border border-base-300 bg-base-200 p-3 text-center">
                        <p className="text-xs opacity-50 mb-0.5">{label}</p>
                        <p className="text-lg font-bold">{Number(value).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                  {insights.components && Object.keys(insights.components).length > 0 && (
                    <div className="rounded-xl border border-base-300 bg-base-200 p-4 space-y-2">
                      <p className="text-xs font-semibold opacity-50 uppercase tracking-widest">Score Breakdown</p>
                      {Object.entries(insights.components).map(([key, val]) => (
                        <div key={key}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="opacity-70 capitalize">{key.replace(/_/g, " ")}</span>
                            <span className="font-semibold">{Math.round(val)}</span>
                          </div>
                          <div className="w-full bg-base-300 rounded-full h-1.5">
                            <div className="bg-blue-700 h-1.5 rounded-full transition-all" style={{ width: `${Math.min(100, val)}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button className="btn btn-outline btn-sm w-full gap-2" disabled={recalcBusy} onClick={triggerRecalc}>
                    {recalcBusy ? <><Spin xs /> Recalculating…</> : <><RefreshCw size={14} /> Recalculate Health Score</>}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   CREATE COMMUNITY MODAL
════════════════════════════════════════════════════════════════════════════ */
function CreateModal({ onClose, onDone }: { onClose: () => void; onDone: (c: CommunityData) => void }) {
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<CreateForm>({
    name: "", description: "", category: "OTHER", tags: "",
    privacy: "PUBLIC", locationRestricted: false, avatarUrl: "",
    allowMemberPosts: true, requirePostApproval: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState<string | null>(null);
  const canNext = form.name.trim().length >= 3 && form.description.trim().length >= 10;

  async function submit() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/communities", {
        method: "POST", headers: hdrs(),
        body: JSON.stringify({
          name: form.name.trim(), description: form.description.trim(),
          category: form.category, tags: form.tags.trim(), privacy: form.privacy,
          avatarUrl: form.avatarUrl.trim() || null,
          locationRestricted: form.locationRestricted,
          allowMemberPosts: form.allowMemberPosts, requirePostApproval: form.requirePostApproval,
        }),
      });
      if (res.status === 401 || res.status === 403) { setErr("Please log in."); return; }
      if (!res.ok) { const d = await res.json().catch(() => ({})); setErr(d?.message || `Error ${res.status}`); return; }
      const d = await res.json(); const raw = d?.data ?? d;
      onDone({ ...raw, isMember: true, isOwner: true, postCount: raw.postCount ?? 0, memberCount: raw.memberCount ?? 1, createdAt: raw.createdAt ?? new Date().toISOString() });
    } catch { setErr("Network error."); }
    finally { setBusy(false); }
  }

  const stepTitle = step === 1 ? "Basic Info" : "Privacy & Settings";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-base-100 rounded-t-3xl sm:rounded-2xl border border-base-300 shadow-2xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex justify-center pt-3 sm:hidden"><div className="w-10 h-1 rounded-full bg-base-300" /></div>
        <div className="flex items-center justify-between px-5 py-4 border-b border-base-300 shrink-0">
          <div>
            <h2 className="font-bold text-base flex items-center gap-2">
              <Plus size={18} className="text-blue-700" /> Create Community
            </h2>
            <div className="flex gap-1 mt-1.5">
              {[1,2].map(s => <div key={s} className={`h-1 w-8 rounded-full transition-all ${step >= s ? "bg-blue-700" : "bg-base-300"}`} />)}
            </div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {err && <div className="bg-error/10 border border-error/30 text-error text-sm rounded-xl px-4 py-2 flex items-center gap-2"><AlertTriangle size={16} /> {err}</div>}
          {step === 1 && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-1">Name <span className="text-error">*</span></label>
                <input autoFocus className="input input-bordered w-full" placeholder="e.g. Pune Cyclists Club" maxLength={60}
                  value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                <p className="text-xs opacity-40 mt-1">{form.name.length}/60 · min 3</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Image URL <span className="opacity-40 font-normal">(optional)</span></label>
                <input className="input input-bordered w-full" placeholder="https://..."
                  value={form.avatarUrl} onChange={e => setForm(f => ({ ...f, avatarUrl: e.target.value }))} />
                <p className="text-xs opacity-50 mt-1 text-blue-700">If left blank, a random robot avatar will be assigned.</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Description <span className="text-error">*</span></label>
                <textarea className="textarea textarea-bordered w-full resize-none" rows={3} maxLength={500}
                  placeholder="What's this community about?"
                  value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
                <p className="text-xs opacity-40 mt-1">{form.description.length}/500</p>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-2">Category</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATS.map(cat => (
                    <button key={cat} type="button" onClick={() => setForm(f => ({ ...f, category: cat }))}
                      className={`rounded-xl border py-2 px-1 text-center text-xs transition-all ${form.category === cat ? "border-blue-700 bg-blue-700/15 text-blue-700 font-semibold" : "border-base-300 hover:border-base-400 opacity-70"}`}>
                      <div className="text-lg mb-0.5">{CAT_ICON[cat]}</div>
                      <div className="leading-tight">{cat.replace(/_/g," ")}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <div>
                <label className="block text-sm font-semibold mb-2">Privacy</label>
                <div className="space-y-2">
                  {(["PUBLIC","PRIVATE","SECRET"] as const).map(p => (
                    <button key={p} type="button" onClick={() => setForm(f => ({ ...f, privacy: p }))}
                      className={`w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all ${form.privacy === p ? "border-blue-700 bg-blue-700/10" : "border-base-300 hover:border-base-400"}`}>
                      <span className="text-2xl">{PRIV_ICON[p]}</span>
                      <div className="flex-1">
                        <p className={`text-sm font-semibold ${form.privacy === p ? "text-blue-700" : ""}`}>{p.charAt(0)+p.slice(1).toLowerCase()}</p>
                        <p className="text-xs opacity-50">{PRIV_DESC[p]}</p>
                      </div>
                      {form.privacy === p && <span className="text-blue-700 font-bold">✓</span>}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Tags <span className="opacity-40 font-normal">(optional, comma-separated)</span></label>
                <input className="input input-bordered w-full text-sm" placeholder="civic, roads, water"
                  value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <label className="block text-sm font-semibold">Settings</label>
                {[
                  { key:"allowMemberPosts",    label:"Members can post",      desc:"Anyone in community can create posts" },
                  { key:"requirePostApproval", label:"Require post approval", desc:"Moderator reviews before publishing" },
                  { key:"locationRestricted",  label:"Location restricted",   desc:"Limit to your pincode area" },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded-xl border border-base-300 p-3 cursor-pointer hover:border-base-400">
                    <div><p className="text-sm font-medium">{label}</p><p className="text-xs opacity-50">{desc}</p></div>
                    <input type="checkbox" className="toggle toggle-primary toggle-sm"
                      checked={form[key as keyof CreateForm] as boolean}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="shrink-0 px-5 py-4 border-t border-base-300 flex gap-3">
          {step === 2 && <button className="btn btn-ghost btn-outline flex-1 gap-1" onClick={() => setStep(1)} disabled={busy}><HiOutlineArrowLeft size={14} /> Back</button>}
          {step === 1
            ? <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 flex-1 gap-1" disabled={!canNext} onClick={() => setStep(2)}>Next <HiOutlineArrowRight size={14} /></button>
            : <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 flex-1" disabled={busy} onClick={submit}>{busy ? <><Spin xs /> Creating…</> : "🚀 Create Community"}</button>
          }
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DETAIL PANEL
════════════════════════════════════════════════════════════════════════════ */
function DetailPanel({
  community,
  onClose,
  onMembershipChange,
}: {
  community: CommunityData;
  onClose: () => void;
  onMembershipChange: (id: number, isMember: boolean, delta: number) => void;
}) {
  const normalise = (raw: CommunityData): CommunityData =>
    raw.isOwner ? { ...raw, isMember: true } : raw;

  const [c, setC]                     = useState(() => normalise(community));
  const [tab, setTab]                 = useState<"posts" | "about">("posts");
  const [posts, setPosts]             = useState<Post[]>([]);
  const [loading, setLoading]         = useState(true);
  const [hasMore, setHasMore]         = useState(false);
  const [cursor, setCursor]           = useState<number | null>(null);
  const [acting, setActing]           = useState(false);
  const [postText, setPostText]       = useState("");
  const [posting, setPosting]         = useState(false);
  const [showCompose, setShowCompose] = useState(false);

  useEffect(() => { setC(normalise(community)); }, [community]);

  const loadPosts = useCallback(async (cur: number | null, replace: boolean) => {
    setLoading(true);
    try {
      const p = new URLSearchParams({ limit: "15" });
      if (cur !== null) p.set("cursor", String(cur));
      const res = await fetch(`/api/communities/${c.id}/posts?${p}`, { headers: hdrs() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const paged: Paged<Post> = data?.data ?? data;
      setPosts(prev => replace ? (paged.content ?? []) : [...prev, ...(paged.content ?? [])]);
      setHasMore(paged.hasMore ?? false);
      setCursor(paged.nextCursor ?? null);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [c.id]);

  useEffect(() => { loadPosts(null, true); }, [loadPosts]);

  async function toggleMembership() {
    setActing(true);
    try {
      if (c.isMember) {
        if (!window.confirm(`Leave "${c.name}"?`)) return;
        const res = await fetch(`/api/communities/${c.id}/leave`, { method: "DELETE", headers: hdrs() });
        if (!res.ok) { alert((await res.json().catch(() => ({}))).message || "Could not leave."); return; }
        setC(p => ({ ...p, isMember: false, memberCount: p.memberCount - 1 }));
        onMembershipChange(c.id, false, -1);
      } else if (c.hasPendingRequest) {
        await fetch(`/api/communities/${c.id}/join-requests/me`, { method: "DELETE", headers: hdrs() });
        setC(p => ({ ...p, hasPendingRequest: false }));
      } else {
        const res = await fetch(`/api/communities/${c.id}/join`, { method: "POST", headers: hdrs(), body: JSON.stringify({}) });
        if (res.status === 401) { alert("Please log in."); return; }
        const d = await res.json(); const joined = d?.data?.joined ?? false;
        setC(p => ({ ...p, isMember: joined, hasPendingRequest: !joined && p.privacy === "PRIVATE", memberCount: joined ? p.memberCount + 1 : p.memberCount }));
        onMembershipChange(c.id, joined, joined ? 1 : 0);
      }
    } catch { alert("Action failed."); }
    finally { setActing(false); }
  }

  async function submitPost() {
    if (!postText.trim()) return;
    setPosting(true);
    try {
      const res = await fetch("/api/posts", { method: "POST", headers: hdrs(), body: JSON.stringify({ content: postText.trim(), communityId: c.id }) });
      if (!res.ok) { alert("Could not post."); return; }
      const d = await res.json();
      setPosts(p => [d?.data ?? d, ...p]);
      setPostText(""); setShowCompose(false);
      setC(p => ({ ...p, postCount: p.postCount + 1 }));
    } catch { alert("Failed to post."); }
    finally { setPosting(false); }
  }

  const canPost  = c.isOwner || (c.isMember && c.allowMemberPosts !== false);
  const isSecret = c.privacy === "SECRET" && !c.isMember;

  return (
    <div className="fixed inset-0 z-40 flex" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative ml-auto w-full max-w-xl h-full bg-base-100 flex flex-col shadow-2xl overflow-hidden"
        style={{ animation: "slideR .22s ease-out" }} onClick={e => e.stopPropagation()}>

        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-b border-base-300">
          <button className="btn btn-ghost btn-sm gap-1" onClick={onClose}>← Back</button>
          {!c.isOwner
            ? <button
                className={`btn btn-sm ${c.isMember ? "btn-ghost btn-outline" : c.hasPendingRequest ? "btn-warning btn-outline" : isSecret ? "btn-disabled" : "bg-blue-700 text-white font-semibold border-none hover:bg-blue-800"}`}
                onClick={toggleMembership} disabled={acting || isSecret}>
                {acting ? <Spin xs /> : c.isMember ? "✓ Joined · Leave" : c.hasPendingRequest ? "⏳ Pending · Cancel" : isSecret ? "Invite Only" : c.privacy === "PRIVATE" ? "Request to Join" : "Join Community"}
              </button>
            : <span className="badge badge-outline badge-sm flex items-center gap-1"><Settings size={12} /> Owner</span>
          }
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            <CommunityHeader community={c} acting={acting} onJoinClick={toggleMembership} />
            <CommunityTabs active={tab} onChange={setTab} />

            {tab === "posts" && (
              <div className="space-y-3">
                {canPost && (
                  !showCompose
                    ? <button className="w-full rounded-xl border border-dashed border-base-300 px-4 py-3 text-left text-sm opacity-60 hover:opacity-100 transition-opacity flex items-center gap-2"><Pencil size={16} /> Write something in {c.name}…</button>
                    : <div className="rounded-xl border border-base-300 bg-base-200 p-3 space-y-2">
                        <textarea autoFocus className="textarea textarea-bordered w-full resize-none text-sm bg-base-100" rows={3}
                          placeholder={`Share something with ${c.name}…`} maxLength={2000}
                          value={postText} onChange={e => setPostText(e.target.value)} />
                        <div className="flex items-center justify-between">
                          <span className="text-xs opacity-40">{postText.length}/2000</span>
                          <div className="flex gap-2">
                            <button className="btn btn-ghost btn-sm" onClick={() => { setShowCompose(false); setPostText(""); }}>Cancel</button>
                            <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm" disabled={!postText.trim() || posting} onClick={submitPost}>{posting ? <Spin xs /> : "Post"}</button>
                          </div>
                        </div>
                      </div>
                )}
                {loading && posts.length === 0 && <div className="flex justify-center py-10"><Spin /></div>}
                {!loading && posts.length === 0 && (
                  <div className="text-center py-12 opacity-50 space-y-2">
                    <div className="flex justify-center mb-2"><Inbox size={40} /></div>
                    <p className="text-sm">{canPost ? "No posts yet — be the first!" : "No posts yet."}</p>
                  </div>
                )}
                {posts.map(post => (
                  <div key={post.id} className="rounded-xl border border-base-300 bg-base-200 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full overflow-hidden border border-base-300 bg-base-200 shrink-0">
                        <img src={`https://robohash.org/${encodeURIComponent(post.authorName || "Unknown")}`} alt="Avatar" className="w-full h-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{post.authorName || "Unknown"}</p>
                        {(post.timeAgo || post.createdAt) && <p className="text-xs opacity-40">{post.timeAgo || post.createdAt}</p>}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed opacity-80 whitespace-pre-line">{post.content}</p>
                    <div className="flex gap-4 mt-2 text-xs opacity-40">
                      <span className="flex items-center gap-1"><Heart size={12} /> {post.likeCount || 0}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={12} /> {post.commentCount || 0}</span>
                    </div>
                  </div>
                ))}
                {hasMore && !loading && (
                  <button className="w-full py-2 text-sm text-blue-700 hover:opacity-70" onClick={() => loadPosts(cursor, false)}>Load more ↓</button>
                )}
              </div>
            )}

            {tab === "about" && (
              <div className="space-y-6">
                {/* Detailed Description */}
                <div className="rounded-xl border border-base-300 bg-base-200 p-5">
                  <h3 className="font-semibold mb-3 text-lg">About this community</h3>
                  <p className="text-sm opacity-80 whitespace-pre-line leading-relaxed">
                    {c.description || "No detailed description provided."}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {([
                    ["Members", c.memberCount.toLocaleString(), <Users size={14} />],
                    ["Posts",   c.postCount.toLocaleString(), <MessageSquare size={14} />],
                    ["Privacy", c.privacy, <Lock size={14} />],
                    ["Since",   new Date(c.createdAt).toLocaleDateString("en-IN",{month:"short",year:"numeric"}), <Calendar size={14} />],
                    c.category     ? ["Category", c.category.replace(/_/g," "), <Tag size={14} />] : null,
                    c.locationName ? ["Location",  c.locationName, <MapPin size={14} />]              : null,
                  ] as Array<[string, string, React.ReactNode] | null>).filter(Boolean).map(([l, v, ico]) => (
                    <div key={l} className="rounded-xl border border-base-300 bg-base-200 p-3">
                      <p className="text-xs opacity-50 mb-1 flex items-center gap-1">{ico} {l}</p>
                      <p className="text-sm font-semibold">{v}</p>
                    </div>
                  ))}
                </div>

                {/* Images Section */}
                <div className="rounded-xl border border-base-300 bg-base-200 p-5">
                  <h3 className="font-semibold mb-3 text-lg">Media & Data</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className="aspect-square rounded-xl bg-base-300/50 flex flex-col items-center justify-center overflow-hidden border border-base-300 text-base-content hover:bg-base-300 transition-colors cursor-pointer">
                        <ImageIcon size={24} className="mb-2 opacity-30" />
                        <span className="text-xs opacity-40 font-semibold uppercase tracking-wider">Image {i}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <CommunitySidebar />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN PAGE
════════════════════════════════════════════════════════════════════════════ */
const Community = () => {
  const [query, setQuery]                                 = useState("");
  const [committed, setCommitted]                         = useState("");
  const [searchResults, setSearchResults]                 = useState<CommunityData[]>([]);
  const [searchLoading, setSearchLoading]                 = useState(false);
  const [searchHasMore, setSearchHasMore]                 = useState(false);
  const [searchCursor, setSearchCursor]                   = useState<number | null>(null);
  const [searchLoadingMore, setSearchLoadingMore]         = useState(false);
  const [suggestions, setSuggestions]                     = useState<CommunityData[]>([]);
  const [showSuggestions, setShowSuggestions]             = useState(false);
  const [myCommunities, setMyCommunities]                 = useState<CommunityData[]>([]);
  const [myCommunitiesLoading, setMyCommunitiesLoading]   = useState(true);
  const [selected, setSelected]                           = useState<CommunityData | null>(null);
  const [adminTarget, setAdminTarget]                     = useState<CommunityData | null>(null);
  const [showCreate, setShowCreate]                       = useState(false);
  const [view, setView]                                   = useState<"default" | "joined" | "owned">("default");

  const inputRef         = useRef<HTMLInputElement>(null);
  const quickDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMyCommunities = useCallback(async () => {
    setMyCommunitiesLoading(true);
    try {
      const [joinedRes, ownedRes] = await Promise.allSettled([
        fetch("/api/communities/me?limit=100", { headers: hdrs() }),
        fetch("/api/communities/owned",         { headers: hdrs() }),
      ]);
      let joined: CommunityData[] = [];
      if (joinedRes.status === "fulfilled" && joinedRes.value.ok) {
        const j = await joinedRes.value.json().catch(() => ({}));
        joined  = (j?.data?.content ?? j?.content ?? []).map((c: CommunityData) => ({ ...c, isMember: c.isMember || c.isOwner }));
      }
      let owned: CommunityData[] = [];
      if (ownedRes.status === "fulfilled" && ownedRes.value.ok) {
        const o = await ownedRes.value.json().catch(() => ({}));
        owned   = (o?.data ?? o?.content ?? []).map((c: CommunityData) => ({ ...c, isMember: true, isOwner: true }));
      }
      const seen = new Set<number>(); const merged: CommunityData[] = [];
      for (const c of [...owned, ...joined]) { if (!seen.has(c.id)) { seen.add(c.id); merged.push(c); } }
      setMyCommunities(merged);
    } catch { setMyCommunities([]); }
    finally { setMyCommunitiesLoading(false); }
  }, []);

  useEffect(() => { fetchMyCommunities(); }, [fetchMyCommunities]);

  /* ── typeahead ── */
  useEffect(() => {
    if (quickDebounceRef.current) clearTimeout(quickDebounceRef.current);
    const q = query.trim();
    if (q.length < 2) { setSuggestions([]); return; }
    quickDebounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search/quick?q=${encodeURIComponent(q)}`, { headers: hdrs() });
        if (!res.ok) return;
        const d = await res.json();
        const allHits: any[] = d?.data ?? d?.content ?? [];
        const communityHits = allHits.filter((r: any) => r.type === "COMMUNITY");
        const mapped = communityHits.map((r: any): CommunityData => ({
          id: r.communityId ?? r.id, name: r.communityName ?? r.name ?? "",
          slug: r.communitySlug ?? r.slug ?? String(r.communityId ?? r.id),
          description: r.communityDescription ?? r.description ?? "",
          category: r.communityCategory ?? r.category ?? null,
          tags: null, avatarUrl: null, coverImageUrl: null,
          privacy: (r.communityPrivacy ?? r.privacy ?? "PUBLIC") as CommunityData["privacy"],
          locationName: r.locationName ?? null, memberCount: r.communityMemberCount ?? r.memberCount ?? 0,
          postCount: 0, isMember: r.communityIsMember ?? r.isMember ?? false,
          isOwner: r.communityIsOwner ?? r.isOwner ?? false, createdAt: r.createdAt ?? new Date().toISOString(),
        }));
        setSuggestions(mapped);
      } catch { setSuggestions([]); }
    }, 300);
    return () => { if (quickDebounceRef.current) clearTimeout(quickDebounceRef.current); };
  }, [query]);

  /* ── full search ── */
  const doSearch = useCallback(async (q: string, cur: number | null, replace: boolean) => {
    if (!q.trim()) return;
    if (replace) setSearchLoading(true); else setSearchLoadingMore(true);
    try {
      const p = new URLSearchParams({ q, type: "COMMUNITY", limit: "20" });
      if (cur !== null) p.set("cursor", String(cur));
      const res = await fetch(`/api/search/type?${p}`, { headers: hdrs() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      const paged = d?.data ?? d;
      const rawItems: any[] = paged?.content ?? paged?.data ?? [];
      const mapped = rawItems.map((r: any): CommunityData => ({
        id: r.communityId ?? r.id, name: r.communityName ?? r.name ?? "",
        slug: r.communitySlug ?? r.slug ?? String(r.communityId ?? r.id),
        description: r.communityDescription ?? r.description ?? "",
        category: r.communityCategory ?? r.category ?? null,
        tags: null, avatarUrl: null, coverImageUrl: null,
        privacy: (r.communityPrivacy ?? r.privacy ?? "PUBLIC") as CommunityData["privacy"],
        locationName: r.locationName ?? null, memberCount: r.communityMemberCount ?? r.memberCount ?? 0,
        postCount: r.postCount ?? 0, isMember: r.communityIsMember ?? r.isMember ?? false,
        isOwner: r.communityIsOwner ?? r.isOwner ?? false, createdAt: r.createdAt ?? new Date().toISOString(),
        allowMemberPosts: r.allowMemberPosts, requirePostApproval: r.requirePostApproval, feedEligible: r.feedEligible,
      }));
      setSearchResults(prev => replace ? mapped : [...prev, ...mapped]);
      setSearchHasMore(paged?.hasMore ?? false);
      setSearchCursor(paged?.nextCursor ?? null);
    } catch { if (replace) setSearchResults([]); }
    finally { if (replace) setSearchLoading(false); else setSearchLoadingMore(false); }
  }, []);

  function commitSearch(q: string) {
    const t = q.trim();
    setQuery(t); setCommitted(t); setShowSuggestions(false); setSuggestions([]);
    setSearchResults([]); setSearchCursor(null); setView("default");
    if (t) doSearch(t, null, true);
  }

  function syncMembership(id: number, isMember: boolean, delta: number) {
    const upd = (c: CommunityData): CommunityData => c.id === id ? { ...c, isMember, memberCount: c.memberCount + delta } : c;
    setSearchResults(p => p.map(upd));
    if (!isMember) setMyCommunities(p => p.filter(c => c.id !== id));
    else setMyCommunities(p => { const e = p.some(c => c.id === id); if (e) return p.map(upd); const f = searchResults.find(c => c.id === id); return f ? [...p, { ...f, isMember: true }] : p; });
  }

  function handleCreated(c: CommunityData) {
    setShowCreate(false);
    const entry: CommunityData = { ...c, isMember: true, isOwner: true };
    setMyCommunities(prev => [entry, ...prev.filter(x => x.id !== entry.id)]);
    setSelected(entry);
  }

  function handleCommunityUpdated(updated: CommunityData) {
    setMyCommunities(p => p.map(c => c.id === updated.id ? updated : c));
    setAdminTarget(updated);
  }

  const isSearching = committed.length > 0;
  const ownedList   = myCommunities.filter(c => c.isOwner);
  const joinedOnly  = myCommunities.filter(c => !c.isOwner);

  return (
    <div className="space-y-4">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Communities</h1>
          <p className="text-sm opacity-70">Discover and join communities based on your interests.</p>
        </div>
        <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm gap-2 shrink-0" onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Create
        </button>
      </div>

      {/* Search bar */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-40 pointer-events-none" size={16} />
            <input ref={inputRef} type="text" placeholder="Search communities..."
              className="input input-bordered w-full pl-10 pr-8" value={query}
              onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              onKeyDown={e => { if (e.key==="Enter") { e.preventDefault(); commitSearch(query); } if (e.key==="Escape") setShowSuggestions(false); }} />
            {query && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 opacity-40 hover:opacity-80"
                onClick={() => { setQuery(""); setCommitted(""); setSearchResults([]); setSuggestions([]); inputRef.current?.focus(); }}><X size={16} /></button>
            )}
            {showSuggestions && query.trim().length >= 2 && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-base-100 border border-base-300 rounded-2xl shadow-xl overflow-hidden">
                {suggestions.map(c => (
                  <button key={c.id} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-base-200 text-left transition-colors"
                    onMouseDown={e => { e.preventDefault(); commitSearch(c.name); }}>
                    <span className="text-blue-700 shrink-0"><Home size={18} /></span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{highlight(c.name, query)}</p>
                      {c.description && <p className="text-xs opacity-50 truncate">{c.description}</p>}
                    </div>
                    <span className="text-xs opacity-30 shrink-0 flex items-center gap-1"><Users size={12} /> {c.memberCount.toLocaleString()}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 px-4" disabled={!query.trim()} onClick={() => commitSearch(query)}>Search</button>
        </div>
      </div>

      {/* Filter pills */}
      {!isSearching && (
        <div className="flex gap-2">
          <button
            onClick={() => setView(v => v === "joined" ? "default" : "joined")}
            className={`btn btn-sm rounded-full gap-1.5 transition-all ${view === "joined" ? "bg-blue-700 text-white font-semibold border-none hover:bg-blue-800" : "btn-ghost border border-base-300 hover:border-blue-700/50"}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-5-3.87M9 20H4v-2a4 4 0 015-3.87m6-4a4 4 0 11-8 0 4 4 0 018 0zm6 0a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            My Communities
            {joinedOnly.length > 0 && (
              <span className={`badge badge-xs ${view === "joined" ? "badge-primary-content bg-white/30" : "badge-ghost"}`}>{joinedOnly.length}</span>
            )}
          </button>
          <button
            onClick={() => setView(v => v === "owned" ? "default" : "owned")}
            className={`btn btn-sm rounded-full gap-1.5 transition-all ${view === "owned" ? "btn-warning" : "btn-ghost border border-base-300 hover:border-warning/50"}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            My Groups
            {ownedList.length > 0 && (
              <span className={`badge badge-xs ${view === "owned" ? "badge-warning-content bg-white/30" : "badge-ghost"}`}>{ownedList.length}</span>
            )}
          </button>
        </div>
      )}

      {/* Search results */}
      {isSearching && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest opacity-40">
              Results for "{committed}"{!searchLoading && searchResults.length > 0 && ` · ${searchResults.length}${searchHasMore?"+":""}`}
            </p>
            <button className="btn btn-ghost btn-xs opacity-50" onClick={() => { setQuery(""); setCommitted(""); setSearchResults([]); }}>Clear</button>
          </div>
          {searchLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({length:4}).map((_,i) => (
                <div key={i} className="rounded-xl border border-base-300 bg-base-200 p-4 animate-pulse space-y-3">
                  <div className="h-4 bg-base-300 rounded w-2/3" /><div className="h-3 bg-base-300 rounded w-full" />
                  <div className="h-3 bg-base-300 rounded w-1/3" /><div className="h-9 bg-base-300 rounded-lg w-full mt-2" />
                </div>
              ))}
            </div>
          )}
          {!searchLoading && searchResults.length === 0 && committed && (
            <div className="text-center py-12 opacity-50 space-y-3">
              <div className="text-4xl">🔍</div>
              <p className="text-sm">No communities found for "{committed}"</p>
              <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm !opacity-100" onClick={() => setShowCreate(true)}>+ Create "{committed}"</button>
            </div>
          )}
          {!searchLoading && searchResults.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2">
              {searchResults.map((c: any) => (
                <CommunityCard key={c.id} slug={c.slug} name={c.name} description={c.description}
                  members={c.memberCount} avatarUrl={c.avatarUrl} privacy={c.privacy} onClick={() => setSelected(c)} />
              ))}
            </div>
          )}
          {searchHasMore && !searchLoading && (
            <button className="w-full py-2 text-sm text-blue-700 hover:opacity-70 transition-opacity"
              disabled={searchLoadingMore} onClick={() => doSearch(committed, searchCursor, false)}>
              {searchLoadingMore ? <Spin xs /> : "Load more ↓"}
            </button>
          )}
        </>
      )}

      {/* My communities */}
      {!isSearching && (
        <>
          {myCommunitiesLoading && (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({length:4}).map((_,i) => (
                <div key={i} className="rounded-xl border border-base-300 bg-base-200 p-4 animate-pulse space-y-3">
                  <div className="h-4 bg-base-300 rounded w-2/3" /><div className="h-3 bg-base-300 rounded w-full" />
                  <div className="h-3 bg-base-300 rounded w-1/3" /><div className="h-9 bg-base-300 rounded-lg w-full mt-2" />
                </div>
              ))}
            </div>
          )}
          {!myCommunitiesLoading && myCommunities.length === 0 && (
            <div className="text-center py-14 opacity-60 space-y-3">
              <div className="flex justify-center mb-2"><Home size={48} className="text-base-content/20" /></div>
              <p className="font-semibold">You haven't joined any communities yet</p>
              <p className="text-sm max-w-xs mx-auto">Search above or create your own community.</p>
            </div>
          )}

          {!myCommunitiesLoading && myCommunities.length > 0 && (
            <div className="space-y-5">

              {/* Owned (created by you) */}
              {(view === "default" || view === "owned") && ownedList.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-40 flex items-center gap-1.5">
                    <Settings size={14} /> Created by you · {ownedList.length}
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {ownedList.map(c => {
                      const ownedImgSrc = c.avatarUrl || `https://robohash.org/${encodeURIComponent(c.name)}`;
                      return (
                      <div key={c.id} className="group relative rounded-2xl border border-base-300 bg-base-100 overflow-hidden transition-all duration-200 hover:border-blue-700/40 hover:shadow-[0_4px_24px_-4px_rgba(29,78,216,0.18)] hover:scale-[1.015] active:scale-[0.98]" style={{ transform: "translateZ(0)" }}>

                        <div className="p-4 cursor-pointer" onClick={() => setSelected({ ...c, isMember: true })}>
                          <div className="flex items-center gap-3.5">
                            {/* Circular avatar */}
                            <div className="shrink-0 w-12 h-12 rounded-full overflow-hidden ring-2 ring-base-300 group-hover:ring-blue-700/40 transition-all duration-200 shadow-sm group-hover:shadow-md">
                              <img
                                src={ownedImgSrc}
                                alt={c.name}
                                className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                onError={e => { (e.target as HTMLImageElement).src = `https://robohash.org/${encodeURIComponent(c.name)}`; }}
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                                <p className="font-bold text-sm truncate">{c.name}</p>
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-warning/15 text-warning border border-warning/20">
                                  <Settings size={8} /> Owner
                                </span>
                                {c.privacy !== "PUBLIC" && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-base-200 text-base-content/60 border border-base-300">
                                    {c.privacy === "SECRET" ? <><EyeOff size={9} /> Secret</> : <><Lock size={9} /> Private</>}
                                  </span>
                                )}
                              </div>
                              {c.description && <p className="text-xs text-base-content/60 line-clamp-1">{c.description}</p>}
                              <p className="text-[11px] font-medium text-base-content/45 mt-1 flex items-center gap-1">
                                <Users size={11} className="text-blue-700/60" /> {c.memberCount.toLocaleString()} members
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="border-t border-base-200 grid grid-cols-2 divide-x divide-base-200">
                          <button
                            className="py-2.5 text-xs font-semibold text-base-content/60 hover:text-base-content hover:bg-base-200 transition-all duration-200 flex items-center justify-center gap-1.5"
                            onClick={() => setSelected({ ...c, isMember: true })}
                          >
                            <Eye size={13} /> View
                          </button>
                          <button
                            className="py-2.5 text-xs font-semibold text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 transition-all duration-200 flex items-center justify-center gap-1.5"
                            onClick={e => { e.stopPropagation(); setAdminTarget(c); }}
                          >
                            <Settings size={13} /> Manage
                          </button>
                        </div>
                      </div>
                    );})}
                  </div>
                </div>
              )}

              {view === "owned" && ownedList.length === 0 && (
                <div className="text-center py-14 opacity-60 space-y-3">
                  <div className="flex justify-center text-base-content/20"><Settings size={48} /></div>
                  <p className="font-semibold">You haven't created any communities yet</p>
                  <button className="btn bg-blue-700 text-white font-semibold border-none hover:bg-blue-800 btn-sm !opacity-100" onClick={() => setShowCreate(true)}>+ Create your first community</button>
                </div>
              )}

              {/* Joined (not owned) */}
              {(view === "default" || view === "joined") && joinedOnly.length > 0 && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-widest opacity-40">✓ Joined · {joinedOnly.length}</p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {joinedOnly.map(c => (
                      <CommunityCard key={c.id} slug={c.slug} name={c.name} description={c.description}
                        members={c.memberCount} avatarUrl={c.avatarUrl} privacy={c.privacy} onClick={() => setSelected(c)} />
                    ))}
                  </div>
                </div>
              )}

              {view === "joined" && joinedOnly.length === 0 && (
                <div className="text-center py-14 opacity-60 space-y-3">
                  <div className="flex justify-center mb-2"><Home size={48} className="text-base-content/20" /></div>
                  <p className="font-semibold">You haven't joined any communities yet</p>
                  <p className="text-sm max-w-xs mx-auto">Search above to discover communities.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Detail panel */}
      {selected && !adminTarget && (
        <DetailPanel community={selected} onClose={() => setSelected(null)} onMembershipChange={syncMembership} />
      )}

      {/* Admin panel */}
      {adminTarget && (
        <AdminPanel community={adminTarget} onClose={() => setAdminTarget(null)} onCommunityUpdated={handleCommunityUpdated} />
      )}

      {/* Create modal */}
      {showCreate && (
        <CreateModal onClose={() => setShowCreate(false)} onDone={handleCreated} />
      )}
    </div>
  );
};

export default Community;
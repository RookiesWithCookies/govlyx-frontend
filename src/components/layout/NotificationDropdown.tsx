import React, { useState, useEffect, useRef } from "react";
import { Bell, CheckCheck, Trash2, ExternalLink, Inbox, UserPlus, X as XIcon, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Notification } from "../../types/notification";

const Spin = ({ xs }: { xs?: boolean }) => (
  <span className={`loading loading-spinner ${xs ? "loading-xs" : "loading-sm"}`} />
);

const NotificationDropdown = ({ unreadCount, onRefresh }: { unreadCount: number, onRefresh: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [acceptedIds, setAcceptedIds] = useState<Set<number>>(new Set());
  const [declinedIds, setDeclinedIds] = useState<Set<number>>(new Set());
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/notifications?limit=20", {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch notifications", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const markAsRead = async (id: number) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/notifications/read-all", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  const deleteNotification = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`/api/notifications/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        setNotifications(prev => prev.filter(n => n.id !== id));
        onRefresh();
      }
    } catch (err) {
      console.error("Failed to delete notification", err);
    }
  };

  /* ── Extract invite token from actionUrl like "/invite/abc123def456" ── */
  const extractInviteToken = (actionUrl?: string): string | null => {
    if (!actionUrl) return null;
    const match = actionUrl.match(/\/invite\/([a-zA-Z0-9]+)$/);
    return match ? match[1] : null;
  };

  /* ── Accept community invite ── */
  const handleAcceptInvite = async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    const inviteToken = extractInviteToken(n.actionUrl);
    if (!inviteToken) return;

    setAcceptingId(n.id);
    try {
      const authToken = localStorage.getItem("token");
      const res = await fetch(`/api/communities/invites/accept/${inviteToken}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({}),
      });
      const d = await res.json().catch(() => ({}));
      if (res.ok) {
        setAcceptedIds(prev => new Set(prev).add(n.id));
        if (!n.isRead) markAsRead(n.id);
        onRefresh();
      } else {
        const msg = d?.error || d?.message || "Could not accept invite.";
        // If already a member, still treat as success
        if (msg.toLowerCase().includes("already")) {
          setAcceptedIds(prev => new Set(prev).add(n.id));
          if (!n.isRead) markAsRead(n.id);
        } else {
          alert(msg);
        }
      }
    } catch {
      alert("Network error. Please try again.");
    } finally {
      setAcceptingId(null);
    }
  };

  /* ── Decline community invite (dismiss notification) ── */
  const handleDeclineInvite = async (n: Notification, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeclinedIds(prev => new Set(prev).add(n.id));
    if (!n.isRead) markAsRead(n.id);
  };

  const handleNotificationClick = (n: Notification) => {
    // Don't navigate for invite notifications that have action buttons
    if (n.notificationType === "COMMUNITY_INVITE" && !acceptedIds.has(n.id) && !declinedIds.has(n.id)) {
      return;
    }
    if (!n.isRead) markAsRead(n.id);
    if (n.actionUrl) {
      navigate(n.actionUrl);
    }
    setIsOpen(false);
  };

  /* ── Check if notification is a community invite ── */
  const isInviteNotification = (n: Notification): boolean => {
    return n.notificationType === "COMMUNITY_INVITE";
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="btn btn-ghost btn-sm hover:bg-blue-700/10 relative"
        aria-label="Notifications"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-error text-error-content text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-base-100 rounded-xl shadow-2xl border border-base-300 z-50 flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
          <div className="px-4 py-3 border-b border-base-300 flex items-center justify-between bg-base-200/50">
            <h3 className="font-bold text-sm">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
              >
                <CheckCheck size={12} /> Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex justify-center py-10"><Spin /></div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 text-center opacity-40">
                <Inbox size={40} className="mb-3" />
                <p className="text-sm font-medium">All caught up!</p>
                <p className="text-xs mt-1">No new notifications to show.</p>
              </div>
            ) : (
              <div className="divide-y divide-base-300">
                {notifications.map((n) => {
                  const isInvite = isInviteNotification(n);
                  const wasAccepted = acceptedIds.has(n.id);
                  const wasDeclined = declinedIds.has(n.id);

                  return (
                    <div
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`p-4 flex gap-3 transition-colors relative group ${
                        isInvite && !wasAccepted && !wasDeclined ? "" : "cursor-pointer hover:bg-base-200"
                      } ${!n.isRead && !wasAccepted && !wasDeclined ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}
                    >
                      {!n.isRead && !wasAccepted && !wasDeclined && (
                        <div className="absolute left-1 top-1/2 -translate-y-1/2 w-1 h-8 bg-blue-600 rounded-full" />
                      )}
                      
                      <div className="shrink-0">
                        <div className={`w-10 h-10 rounded-full overflow-hidden border bg-base-300 ${
                          isInvite && !wasAccepted && !wasDeclined
                            ? "border-blue-500/50 ring-2 ring-blue-500/20"
                            : "border-base-300"
                        }`}>
                          <img
                            src={
                              n.triggeredByProfileImage ||
                              `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(
                                n.triggeredByUsername || "sys"
                              )}`
                            }
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold text-base-content leading-tight line-clamp-1">
                            {isInvite && (
                              <UserPlus size={12} className="inline mr-1 text-blue-600" />
                            )}
                            {n.title}
                          </p>
                          <span className="text-[10px] opacity-40 whitespace-nowrap">
                            {n.timeAgo}
                          </span>
                        </div>
                        <p className="text-xs mt-1 opacity-70 line-clamp-2 leading-relaxed">
                          {n.message}
                        </p>

                        {/* ── Invite action buttons ── */}
                        {isInvite && !wasAccepted && !wasDeclined && (
                          <div className="flex items-center gap-2 mt-2.5">
                            <button
                              onClick={(e) => handleAcceptInvite(n, e)}
                              disabled={acceptingId === n.id}
                              className="flex-1 btn btn-xs bg-blue-700 text-white border-none hover:bg-blue-800 gap-1 font-semibold rounded-lg h-7 min-h-0"
                            >
                              {acceptingId === n.id ? (
                                <Spin xs />
                              ) : (
                                <>
                                  <Check size={12} />
                                  Accept
                                </>
                              )}
                            </button>
                            <button
                              onClick={(e) => handleDeclineInvite(n, e)}
                              className="flex-1 btn btn-xs btn-ghost border border-base-300 gap-1 font-medium rounded-lg h-7 min-h-0 hover:bg-error/10 hover:text-error hover:border-error/30"
                            >
                              <XIcon size={12} />
                              Decline
                            </button>
                          </div>
                        )}

                        {/* ── Accepted state ── */}
                        {isInvite && wasAccepted && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-success">
                            <Check size={14} />
                            Joined successfully!
                          </div>
                        )}

                        {/* ── Declined state ── */}
                        {isInvite && wasDeclined && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs opacity-40">
                            <XIcon size={12} />
                            Invite declined
                          </div>
                        )}
                      </div>

                      {/* Delete button — hide for active invite notifications */}
                      {!(isInvite && !wasAccepted && !wasDeclined) && (
                        <div className="shrink-0 flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => deleteNotification(n.id, e)}
                            className="btn btn-ghost btn-xs btn-circle text-error hover:bg-error/10"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-base-300 bg-base-200/30 text-center">
            <button
               onClick={() => { navigate("/settings"); setIsOpen(false); }}
               className="text-[11px] opacity-50 hover:opacity-100 flex items-center justify-center gap-1 mx-auto"
            >
              Notification Settings <ExternalLink size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;

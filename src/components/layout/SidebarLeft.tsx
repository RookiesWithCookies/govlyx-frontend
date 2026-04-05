import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Dices,
  User,
  Settings,
  LayoutDashboard,
  Bell,
} from "lucide-react";
import { useCurrentUser } from "../../hooks/useUser";
import { useUnreadNotificationsCount } from "../../hooks/useNotification";

const BASE_NAV_ITEMS = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Communities", icon: Users, to: "/communities" },
  { label: "Notifications", icon: Bell, to: "/notifications" },
  { label: "Quick Chat", icon: Dices, to: "/quick-chat" },
  { label: "Profile", icon: User, to: "/profile" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

const DEPT_NAV_ITEM = { label: "Dept. Dashboard", icon: LayoutDashboard, to: "/department/dashboard" };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const SidebarLeft = () => {
  const { data: user, isLoading: loading } = useCurrentUser();
  const { data: unreadCount } = useUnreadNotificationsCount();

  // Simple check for role since useCurrentUser returns the full profile
  const isDept = user?.role === "ROLE_DEPARTMENT";
  const username = user?.actualUsername ?? user?.username;

  const navItems = isDept
    ? [...BASE_NAV_ITEMS.slice(0, 3), DEPT_NAV_ITEM, ...BASE_NAV_ITEMS.slice(3)]
    : BASE_NAV_ITEMS;

  // Removing unused avatarLetter
  const displayName = loading ? "Loading..." : (username ?? "Anonymous User");

  return (
    <aside className="flex min-h-full flex-col gap-6 pb-8">

      {/* Profile Card */}
      <div className="rounded-xl bg-base-200 p-4">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="w-10 rounded-full overflow-hidden bg-base-200 border border-base-300">
              <img src={`https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(displayName)}`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <p className="font-semibold">{displayName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="rounded-xl bg-base-200 p-2">
        {navItems.map(({ label, icon: Icon, to }) => {
          const isNotifications = label === "Notifications";

          return (
            <NavLink
              key={label}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition relative
                ${isActive
                  ? "bg-[#1D4ED8] text-white"
                  : "hover:bg-base-300"
                }`
              }
            >
              <Icon size={18} />
              <span className="flex-1">{label}</span>
              {isNotifications && unreadCount !== undefined && unreadCount > 0 && (
                <span className="bg-error text-error-content text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Communities Placeholder */}
      <div className="rounded-xl bg-base-200 p-4">
        <p className="mb-2 text-sm font-semibold opacity-70">
          Your Communities
        </p>
        <ul className="space-y-2 text-sm opacity-80">
          <li className="truncate">Delhi NCR</li>
          <li className="truncate">Tech Support</li>
          <li className="truncate">Education India</li>
          <li className="truncate">Baramati News</li>
        </ul>
      </div>

    </aside>
  );
};

export default SidebarLeft;

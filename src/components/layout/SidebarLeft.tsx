import { NavLink } from "react-router-dom";
import {
  Home,
  Users,
  Dices,
  User,
  Settings,
} from "lucide-react";
import { HiOutlineArrowRight } from "react-icons/hi";
import { useState, useEffect } from "react";

const navItems = [
  { label: "Home", icon: Home, to: "/" },
  { label: "Communities", icon: Users, to: "/communities" },
  { label: "Quick Chat", icon: Dices, to: "/quick-chat" },
  { label: "Profile", icon: User, to: "/profile" },
  { label: "Settings", icon: Settings, to: "/settings" },
];

// ---------------------------------------------------------------------------
// Hook: fetch the currently authenticated user from GET /api/users/me
//
// IMPORTANT: User.getUsername() in Spring Security returns the EMAIL.
// The display username lives in getActualUsername() → serialized as "actualUsername".
// ---------------------------------------------------------------------------
function useCurrentUser() {
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token"); // adjust key if your app uses a different one

    fetch("/api/users/me", {
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch user");
        return res.json();
      })
      .then((body) => {
        // ApiResponse<User> shape: { data: { actualUsername: "...", ... } }
        // "actualUsername" comes from User.getActualUsername() (the real display name)
        // "username" from User.getUsername() returns EMAIL — don't use that here
        const user = body?.data;
        setUsername(user?.actualUsername ?? user?.username ?? null);
      })
      .catch(() => setUsername(null))
      .finally(() => setLoading(false));
  }, []);

  return { username, loading };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
const SidebarLeft = () => {
  const { username, loading } = useCurrentUser();

  // Removing unused avatarLetter
  const displayName = loading ? "Loading..." : (username ?? "Anonymous User");

  return (
    <aside className="flex h-full flex-col gap-6">

      {/* Profile Card */}
      <div className="rounded-xl bg-base-200 p-4">
        <div className="flex items-center gap-3">
          <div className="avatar placeholder">
            <div className="w-10 rounded-full overflow-hidden bg-base-200 border border-base-300">
              <img src={`https://robohash.org/${encodeURIComponent(displayName)}`} alt="Avatar" className="w-full h-full object-cover" />
            </div>
          </div>
          <div>
            <p className="font-semibold">{displayName}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="rounded-xl bg-base-200 p-2">
        {navItems.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={label}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition
               ${
                 isActive
                   ? "bg-blue-700 text-white"
                   : "hover:bg-base-300"
               }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
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

      {/* Official Updates */}
      <div className="rounded-xl bg-base-200 p-4">
        <h3 className="font-semibold text-sm mb-2">Official Updates</h3>
        <NavLink
          to="/department-feed"
          className="text-sm text-blue-700 hover:underline"
        >
          View government announcements <HiOutlineArrowRight className="inline-block" />
        </NavLink>
      </div>
    </aside>
  );
};

export default SidebarLeft;
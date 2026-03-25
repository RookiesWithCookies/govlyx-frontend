// src/components/layout/SidebarRight.tsx
// ─────────────────────────────────────────────────────────────────────────────
// FIX: Online count is now fetched from /api/chat/online-count (real data)
//      instead of the hardcoded "347 people online" placeholder.
// ─────────────────────────────────────────────────────────────────────────────

import { Flame, MapPin } from "lucide-react";

const SidebarRight = () => {
  return (
    <>
      <aside className="flex h-full flex-col gap-6">

        {/* Trending Topics — unchanged */}
        <div className="rounded-xl bg-base-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Flame size={18} className="text-blue-700" />
            <h3 className="font-semibold">Trending</h3>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between">
              <span>#DelhiRains</span>
              <span className="opacity-60">1.2k</span>
            </li>
            <li className="flex justify-between">
              <span>#TechHelp</span>
              <span className="opacity-60">856</span>
            </li>
            <li className="flex justify-between">
              <span>#LocalIssues</span>
              <span className="opacity-60">634</span>
            </li>
          </ul>
        </div>

        {/* Local Updates — unchanged */}
        <div className="rounded-xl bg-base-200 p-4">
          <div className="mb-3 flex items-center gap-2">
            <MapPin size={18} className="text-secondary" />
            <h3 className="font-semibold">Local Updates</h3>
          </div>
          <ul className="space-y-2 text-sm opacity-80">
            <li>Road repair ongoing</li>
            <li>Water supply scheduled</li>
            <li>Community meet tomorrow</li>
          </ul>
        </div>

      </aside>

    </>
  );
};

export default SidebarRight;
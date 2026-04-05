import { Outlet } from "react-router-dom";
import { motion } from "framer-motion";
import Navbar from "./Navbar";
import SidebarLeft from "./SidebarLeft";
import SidebarRight from "./SidebarRight";
import DepartmentRequestModal from "../modals/DepartmentRequestModal";

const MainLayout = () => {
  return (
    <div className="drawer lg:drawer-open">
      <DepartmentRequestModal />
      {/* Drawer toggle */}
      <input id="mobile-drawer" type="checkbox" className="drawer-toggle" />

      {/* MAIN CONTENT */}
      <div className="drawer-content h-screen overflow-hidden">
        <motion.div
          className="h-screen bg-base-100 text-base-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Navbar */}
          <Navbar />

          {/* Layout area BELOW navbar */}
          <div className="pt-14 h-[calc(100vh-3.5rem)]">
            <div className="mx-auto max-w-[1780px] px-4 h-full">
              <div className="grid grid-cols-12 gap-4 mt-3 h-full">

                {/* LEFT SIDEBAR */}
                <aside className="hidden lg:block lg:col-span-3 h-full">
                  <div className="h-full overflow-y-auto">
                    <SidebarLeft />
                  </div>
                </aside>

                {/* CENTER */}
                <main className="col-span-12 lg:col-span-9 xl:col-span-6 h-full overflow-y-auto">
                  <Outlet />
                </main>
                
                {/* RIGHT SIDEBAR */}
                <aside className="hidden xl:block xl:col-span-3 h-full">
                  <div className="h-full overflow-y-auto">
                    <SidebarRight />
                  </div>
                </aside>

              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* MOBILE DRAWER */}
      <div className="drawer-side lg:hidden z-50">
        <label
          htmlFor="mobile-drawer"
          className="drawer-overlay mt-14 h-[calc(100vh-3.5rem)]"
        />

        <div className="mt-14 h-[calc(100vh-3.5rem)] w-72 bg-base-200 p-4 flex flex-col">
          {/* Drawer Header */}
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm font-semibold opacity-70">Menu</span>
            <label htmlFor="mobile-drawer" className="btn btn-ghost btn-sm">
              ✕
            </label>
          </div>

          <div className="flex-1 overflow-y-auto">
            <SidebarLeft />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainLayout;

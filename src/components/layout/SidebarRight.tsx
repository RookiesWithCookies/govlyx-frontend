import { Flame, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import govlyxLogo from "../../assets/govlyx.svg";

const SidebarRight = () => {
  return (
    <>
      <aside className="flex min-h-full flex-col gap-4 pb-12">

        {/* Trending Topics — unchanged */}
        <div className="rounded-xl bg-base-200 p-3">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Flame size={16} className="text-[#1D4ED8]" />
            <h3 className="text-xs font-black uppercase tracking-wider opacity-60">Trending</h3>
          </div>
          <ul className="space-y-1 text-sm font-bold">
            <li className="flex justify-between hover:bg-base-300 p-1.5 rounded-lg transition-colors cursor-pointer">
              <span>#DelhiRains</span>
              <span className="opacity-40 text-xs">1.2k</span>
            </li>
            <li className="flex justify-between hover:bg-base-300 p-1.5 rounded-lg transition-colors cursor-pointer">
              <span>#TechHelp</span>
              <span className="opacity-40 text-xs">856</span>
            </li>
            <li className="flex justify-between hover:bg-base-300 p-1.5 rounded-lg transition-colors cursor-pointer">
              <span>#LocalIssues</span>
              <span className="opacity-40 text-xs">634</span>
            </li>
          </ul>
        </div>

        {/* Govlyx for Bodies (Department Request) */}
        <div className="rounded-2xl bg-base-200 border border-base-300 p-4 space-y-3 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 text-[#1D4ED8]">
            <ShieldCheck size={18} />
            <span className="text-sm font-bold">Govlyx for Bodies</span>
          </div>
          <p className="text-[11px] text-base-content/60 tracking-tight leading-relaxed font-medium">
            Are you a government official? Apply for a verified department account to resolve citizen issues and communicate with your community.
          </p>
          <button
            onClick={() => (window as any).openDeptRequestModal?.()}
            className="btn btn-sm w-full bg-[#1D4ED8] hover:bg-[#1D4ED8]/90 text-white border-none rounded-xl text-xs font-bold shadow-lg shadow-[#1D4ED8]/20 h-10"
          >
            Request Access
          </button>
        </div>

        {/* 3D App Logo Section */}
        <div className="mt-4 flex flex-col items-center p-2">
          <motion.div
            className="relative flex h-32 w-32 items-center justify-center"
            initial={{ rotateY: 0, rotateX: 0 }}
            animate={{
              rotateY: [0, 15, 0, -15, 0],
              rotateX: [0, 5, 0, -5, 0],
              y: [0, -4, 0]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ perspective: 1000, transformStyle: "preserve-3d" }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 scale-125 rounded-full bg-[#1D4ED8]/10 blur-xl filter" />

            <motion.img
              src={govlyxLogo}
              alt="Govlyx Logo"
              className="z-10 h-28 w-28 drop-shadow-2xl opacity-80"
              whileHover={{ scale: 1.1, rotateY: 180 }}
              transition={{ duration: 0.8 }}
            />
          </motion.div>
          <p className="mt-2 text-center text-xs font-black tracking-[0.4em] opacity-40 uppercase">
            Govlyx
          </p>
        </div>

      </aside>

    </>
  );
};

export default SidebarRight;
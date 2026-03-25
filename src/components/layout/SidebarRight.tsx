import { Flame, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import govlyxLogo from "../../assets/govlyx.svg";

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

        {/* 3D App Logo Section */}
        <div className="flex flex-1 flex-col items-center justify-center p-4">
          <motion.div
            className="relative flex h-48 w-48 items-center justify-center"
            initial={{ rotateY: 0, rotateX: 0 }}
            animate={{ 
              rotateY: [0, 15, 0, -15, 0],
              rotateX: [0, 5, 0, -5, 0],
              y: [0, -10, 0]
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut"
            }}
            style={{ perspective: 1000, transformStyle: "preserve-3d" }}
          >
            {/* Glow effect */}
            <div className="absolute inset-0 scale-110 rounded-full bg-primary/20 blur-2xl filter" />
            
            <motion.img 
              src={govlyxLogo} 
              alt="Govlyx Logo" 
              className="z-10 h-32 w-32 drop-shadow-2xl"
              whileHover={{ scale: 1.1, rotateY: 180 }}
              transition={{ duration: 0.8 }}
            />
          </motion.div>
          <p className="mt-4 text-center text-sm font-bold tracking-widest opacity-40 uppercase">
            Govlyx
          </p>
        </div>

      </aside>

    </>
  );
};

export default SidebarRight;
import { Users, Settings } from "lucide-react";

type CommunityHeaderProps = {
  community: {
    name: string;
    description: string;
    memberCount: number;
    isOwner: boolean;
    isMember: boolean;
    hasPendingRequest?: boolean;
    privacy: string;
    avatarUrl?: string | null;
    coverImageUrl?: string | null;
  };
  acting?: boolean;
  onJoinClick?: () => void;
};

const CommunityHeader = ({ community: c, acting, onJoinClick }: CommunityHeaderProps) => {
  const isSecret = c.privacy === "SECRET" && !c.isMember;
  
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 overflow-hidden shadow-sm mb-4 mt-2">
      {/* Cover Image */}
      <div className="h-32 w-full bg-base-200 relative">
        {c.coverImageUrl ? (
          <img src={c.coverImageUrl} alt="Cover" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-blue-700/10 to-blue-500/5 border-b border-base-300" />
        )}
      </div>

      <div className="px-5 pb-5 relative">
        {/* Avatar */}
        <div className="absolute -top-10 left-5 w-20 h-20 rounded-2xl border-4 border-base-100 bg-blue-700/10 flex items-center justify-center font-bold text-3xl text-blue-700 shadow-sm overflow-hidden">
          {c.avatarUrl ? (
            <img src={c.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
          ) : (
            c.name[0].toUpperCase()
          )}
        </div>

        {/* Action Button */}
        <div className="flex justify-end pt-3 h-10">
          {!c.isOwner ? (
             <button
               className={`btn btn-sm ${c.isMember ? "btn-ghost btn-outline" : c.hasPendingRequest ? "btn-warning btn-outline" : isSecret ? "btn-disabled" : "bg-blue-700 text-white border-none hover:bg-blue-800"}`}
               onClick={onJoinClick} disabled={acting || isSecret}>
               {acting ? <span className="loading loading-spinner loading-xs" /> : c.isMember ? "✓ Joined" : c.hasPendingRequest ? "⏳ Pending" : isSecret ? "Invite Only" : c.privacy === "PRIVATE" ? "Request to Join" : "Join"}
             </button>
          ) : (
             <span className="badge badge-warning gap-1 font-semibold badge-md"><Settings size={14} /> Owner</span>
          )}
        </div>

        <div className="mt-2 text-left">
          <h1 className="text-2xl font-bold">{c.name}</h1>
          <p className="mt-1 text-sm opacity-80 break-words leading-relaxed max-w-2xl line-clamp-2">
            {c.description}
          </p>

          <div className="mt-4 flex items-center gap-4 text-sm font-medium opacity-60">
            <span className="flex items-center gap-1.5"><Users size={16} /> {c.memberCount.toLocaleString()} members</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommunityHeader;

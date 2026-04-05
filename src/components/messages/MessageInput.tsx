import { Send } from "lucide-react";

const MessageInput = () => {
  return (
    <div className="border-t border-base-300 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          placeholder="Type a message…"
          className="input input-bordered flex-1"
        />
        <button className="btn btn-sm bg-blue-700 text-white hover:bg-blue-800">
          <Send size={16} />
        </button>
      </div>
    </div>
  );
};

export default MessageInput;

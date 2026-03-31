import StrangerChat from "../components/layout/StrangerChat";
import { useNavigate } from "react-router-dom";

const QuickChatPage = () => {
  const navigate = useNavigate();

  return (
    <div className="h-full flex flex-col">
      <StrangerChat standalone onClose={() => navigate("/")} />
    </div>
  );
};

export default QuickChatPage;

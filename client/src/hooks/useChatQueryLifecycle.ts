import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";
import { useRolePlay } from "@/contexts/RolePlayContext";

function refetchChatMessages(chatId?: string) {
  if (!chatId) {
    return;
  }
  queryClient.refetchQueries({
    queryKey: [`/api/chats/${chatId}/messages`],
    type: "active",
    exact: true,
  });
}

export function useChatQueryLifecycle(chatId?: string) {
  const { setIsTyping } = useRolePlay();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const triggerRefresh = () => {
      if (document.visibilityState === "visible") {
        setIsTyping(false);
        refetchChatMessages(chatId);
      }
    };

    const handleFocus = () => {
      setIsTyping(false);
      refetchChatMessages(chatId);
    };

    document.addEventListener("visibilitychange", triggerRefresh);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", triggerRefresh);
      window.removeEventListener("focus", handleFocus);
    };
  }, [chatId, setIsTyping]);
}

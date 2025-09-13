import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@/contexts/NavigationContext";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { Button } from "@/components/ui/button";

const StoryIndexPage = () => {
  const { navigateToPath } = useNavigation();

  const { data, isLoading, error, refetch } = useQuery<{ packs: string[] }>({
    queryKey: ["/api/story/packs"],
    queryFn: async () => {
      const res = await fetch("/api/story/packs");
      if (!res.ok) throw new Error("Failed to load story packs");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { mutate: startSession, isPending } = useMutation({
    mutationFn: async (packId: string) => {
      const res = await fetch("/api/story/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId, roleName: "", nsfwMode: false }),
      });
      if (!res.ok) throw new Error("Failed to start session");
      return res.json();
    },
    onSuccess: (data: any) => {
      navigateToPath(`/story/${data.sessionId}`);
    },
  });

  return (
    <GlobalLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-4">故事模式</h1>
        <p className="text-sm text-gray-400 mb-6">选择一个故事包开始游玩（原型）。</p>

        {isLoading ? (
          <div className="space-y-2">
            {[0,1,2].map(i => (
              <div key={i} className="h-16 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-sm text-red-400">加载失败。
            <Button size="sm" variant="outline" className="ml-2" onClick={() => refetch()}>重试</Button>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {(data?.packs || []).map((packId) => (
              <div key={packId} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{packId}</h3>
                  <p className="text-xs text-gray-400">原型包 · 本地</p>
                </div>
                <Button disabled={isPending} onClick={() => startSession(packId)}>
                  {isPending ? "创建中..." : "开始"}
                </Button>
              </div>
            ))}
            {(!data || data.packs.length === 0) && (
              <div className="text-sm text-gray-400">暂无可用故事包</div>
            )}
          </div>
        )}
      </div>
    </GlobalLayout>
  );
};

export default StoryIndexPage;


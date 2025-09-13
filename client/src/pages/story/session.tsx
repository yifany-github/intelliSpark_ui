import { useEffect } from "react";
import { useRoute } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import StoryChat from "@/components/story/StoryChat";
import RelationshipHUD from "@/components/story/RelationshipHUD";
import { Button } from "@/components/ui/button";

const StorySessionPage = () => {
  const [, params] = useRoute("/story/:id");
  const sessionId = params?.id;

  const { data, isLoading, error, refetch } = useQuery<{ sessionId: number; scene: any; restricted?: boolean; requiresGeneration?: boolean }>({
    queryKey: ["/api/story/sessions", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await fetch(`/api/story/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to load session");
      return res.json();
    },
  });

  const { mutate: choose, isPending } = useMutation({
    mutationFn: async (choiceId: string) => {
      const res = await fetch(`/api/story/sessions/${sessionId}/choice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choiceId }),
      });
      if (!res.ok) throw new Error("Failed to apply choice");
      return res.json();
    },
    onSuccess: () => {
      refetch();
    },
  });

  const { mutate: generate, isPending: isGenerating } = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/story/sessions/${sessionId}/generate`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 402) {
          const payload = await res.json().catch(() => ({}));
          throw new Error('需要代币以生成对白');
        }
        throw new Error('Failed to generate');
      }
      return res.json();
    },
    onSuccess: () => refetch(),
    onError: (e: any) => {
      alert(e?.message || '生成失败');
    }
  });

  const scene = data?.scene;
  const safeNext = data?.restrictedSafeNext as string | undefined;
  const npcMap = React.useMemo(() => {
    const map: Record<string, { name?: string; avatarUrl?: string }> = {};
    (data?.npcs || []).forEach((n: any) => { map[n.id] = { name: n.name, avatarUrl: n.avatarUrl }; });
    return map;
  }, [data?.npcs]);

  return (
    <GlobalLayout showSidebar={false}>
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        <div className="border-b border-gray-700 pb-3">
          <h1 className="text-xl font-bold">故事会话 #{sessionId}</h1>
          <p className="text-sm text-gray-400">原型界面 · 多角色与分支叙事</p>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            <div className="h-6 w-40 bg-gray-800 rounded animate-pulse" />
            <div className="h-24 bg-gray-800 rounded animate-pulse" />
          </div>
        ) : error ? (
          <div className="text-sm text-red-400">加载失败。
            <Button size="sm" variant="outline" className="ml-2" onClick={() => refetch()}>重试</Button>
          </div>
        ) : scene ? (
          <div className="space-y-6">
            <div>
              {scene.title && (<h2 className="text-lg font-semibold mb-2">{scene.title}</h2>)}
              <StoryChat history={(data?.history as any[]) || []} scene={scene} npcMap={npcMap} />
              {data?.restricted && (
                <div className="text-xs text-amber-400 mt-2 flex items-center justify-between">
                  <span>NSFW 关闭，当前场景内容已隐藏</span>
                  {safeNext && (
                    <Button size="sm" variant="outline" onClick={async () => {
                      await fetch(`/api/story/sessions/${sessionId}/skip`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetSceneId: safeNext }) });
                      refetch();
                    }}>跳过该段</Button>
                  )}
                </div>
              )}
            </div>

            <RelationshipHUD relations={data?.relations as any} />

            {Array.isArray(scene.choices) && scene.choices.length > 0 && !data?.restricted && (
              <div>
                <div className="text-sm text-gray-400 mb-2">选择：</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {scene.choices.map((c: any) => (
                    <Button key={c.id} disabled={isPending} onClick={() => choose(c.id)}>{c.text}</Button>
                  ))}
                </div>
              </div>
            )}

            {data?.requiresGeneration && !data?.restricted && (
              <div>
                <div className="text-sm text-gray-400 mb-2">需要生成对白：</div>
                <Button disabled={isGenerating} onClick={() => generate()}>
                  {isGenerating ? '生成中…' : '生成对白'}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400">无场景数据</div>
        )}
      </div>
    </GlobalLayout>
  );
};

export default StorySessionPage;

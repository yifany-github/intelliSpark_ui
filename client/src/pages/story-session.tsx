import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BookOpen, Clock, Loader2, MapPin, RefreshCcw, Send, Sparkles, UserCircle } from "lucide-react";

import GlobalLayout from "@/components/layout/GlobalLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { StoryChoice, StorySession, StoryTurnResponse } from "@/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import ChatModelSelector from "@/components/chats/ChatModelSelector";

interface StorySessionPageProps {
  sessionId: string;
}

const StorySessionPage = ({ sessionId }: StorySessionPageProps) => {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<StoryTurnResponse[]>([]);
  const [choices, setChoices] = useState<StoryChoice[]>([]);
  const scrollAnchorRef = useRef<HTMLDivElement | null>(null);

  const {
    data: session,
    isLoading,
    isError,
    refetch,
  } = useQuery<StorySession>({
    queryKey: [`/api/story-sessions/${sessionId}`],
  });

  const { mutate: submitTurn, isPending } = useMutation({
    mutationFn: async (payload: { text: string }) => {
      const response = await apiRequest("POST", `/api/story-sessions/${sessionId}/turn`, {
        userRole: session?.userRole,
        text: payload.text,
      });
      const data = (await response.json()) as StoryTurnResponse;
      return data;
    },
    onSuccess: (data) => {
      setTurns((prev) => [...prev, data]);
      queryClient.invalidateQueries({ queryKey: [`/api/story-sessions/${sessionId}`] });
      queryClient.setQueryData([`/api/story-sessions/${sessionId}`], (prev) => {
        if (!prev) return prev;
        return { ...prev, state: data.state } as StorySession;
      });
      setInput("");
      setChoices(data.choices || []);
    },
    onError: () => {
      toast({ title: t("storyTurnFailed"), variant: "destructive" });
    },
  });

  const sendTurn = () => {
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }
    submitTurn({ text: trimmed });
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    sendTurn();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      sendTurn();
    }
  };

  const state = session?.state ?? {};
  const flags = (state.flags ?? {}) as Record<string, boolean>;
  const inventories = (state.inventories ?? {}) as Record<string, string[]>;
  const introNarration = session?.introNarration;
  const roleIntro = session?.roleIntro;

  useEffect(() => {
    if (session?.choices) {
      setChoices(session.choices);
    }
  }, [session]);

  useEffect(() => {
    scrollAnchorRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  return (
    <GlobalLayout>
      <div className="px-4 py-6 space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">{t("storytelling")}</p>
            <h1 className="text-2xl font-semibold text-white">{t("storySession")}</h1>
          </div>
          <div className="flex items-center gap-3">
            <ChatModelSelector />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              className="bg-slate-800 text-slate-200 hover:bg-slate-700"
            >
              <RefreshCcw className="mr-2 h-4 w-4" />
              {t("retry")}
            </Button>
          </div>
        </div>

        {isError && (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
            {t("storyTurnFailed")}
          </div>
        )}

        {(isLoading || !session) && !isError ? (
          <div className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>{t("loadingStories")}</span>
          </div>
        ) : null}

        {session && !isLoading && !isError ? (
          <div className="grid gap-6 lg:grid-cols-[320px,1fr] lg:h-[calc(100vh-180px)] lg:overflow-hidden">
            <aside className="space-y-4 lg:h-full lg:overflow-y-auto pr-1">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 shadow-sm shadow-black/30">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Sparkles className="h-4 w-4 text-blue-300" />
                    {session.storyId}
                  </div>
                  {session.userRole && (
                    <Badge variant="outline" className="border-emerald-400/50 text-emerald-300">
                      <UserCircle className="mr-1 h-3 w-3" />
                      {session.userRole}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 space-y-3 text-sm text-slate-200">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-300" />
                    {t("storyScene")}: {state.scene_id || t("none")}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-300" />
                    {t("storyTime")}: {state.time || t("none")}
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-pink-300" />
                    {t("storyLocation")}: {state.location || t("none")}
                  </div>
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("storyFlags")}</p>
                <div className="space-y-2">
                  {Object.keys(flags).length === 0 ? (
                    <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
                      {t("none")}
                    </div>
                  ) : (
                    Object.entries(flags).map(([flagKey, value]) => (
                      <div
                        key={flagKey}
                        className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-950/30 px-3 py-2"
                      >
                        <span className="text-xs font-medium text-slate-200">{flagKey}</span>
                        <span className={`text-xs font-semibold ${value ? "text-emerald-300" : "text-slate-500"}`}>
                          {value ? "✔" : "—"}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-xs uppercase tracking-wide text-slate-400">{t("storyInventory")}</p>
                {Object.keys(inventories).length === 0 ? (
                  <div className="rounded-lg border border-slate-800/80 bg-slate-950/40 px-3 py-2 text-xs text-slate-500">
                    {t("none")}
                  </div>
                ) : (
                  Object.entries(inventories).map(([role, items]) => (
                    <div
                      key={role}
                      className="space-y-2 rounded-xl border border-slate-800/80 bg-slate-950/30 px-3 py-3"
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-200">
                        <UserCircle className="h-4 w-4 text-blue-200" />
                        {role}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {items.length > 0 ? (
                          items.map((item) => (
                            <Badge key={`${role}-${item}`} variant="secondary" className="bg-slate-800/80 text-slate-100">
                              {item}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-xs text-slate-500">{t("none")}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </aside>

            <section className="flex h-full flex-col rounded-2xl border border-slate-800 bg-slate-900/70 shadow-inner shadow-black/30 lg:overflow-hidden">
              <div className="border-b border-slate-800 bg-slate-900/80 px-6 py-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-400">{t("storyNarration")}</p>
                    <h2 className="text-xl font-semibold text-white">{state.scene_id || t("storyScene")}</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {state.time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-amber-300" />
                        {state.time}
                      </span>
                    )}
                    {state.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-pink-300" />
                        {state.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <ScrollArea className="flex-1 px-6 py-5">
                <div className="space-y-4 text-sm text-slate-200">
                  {(introNarration || roleIntro) && (
                    <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                      {introNarration && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("storytelling")}</p>
                          <p className="leading-relaxed text-slate-100 whitespace-pre-line">{introNarration}</p>
                        </div>
                      )}
                      {roleIntro && (
                        <div>
                          <p className="text-xs uppercase tracking-wide text-slate-400 mb-1">{t("selectRole")}</p>
                          <p className="leading-relaxed text-slate-200 whitespace-pre-line">{roleIntro}</p>
                        </div>
                      )}
                    </div>
                  )}
                  {turns.length === 0 ? (
                    <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 text-center">
                      <Sparkles className="mx-auto mb-3 h-6 w-6 text-blue-300" />
                      <p className="text-sm leading-relaxed text-slate-300">
                        {t("storyTurnPlaceholder")}
                      </p>
                    </div>
                  ) : (
                    turns.map((turn, index) => (
                      <div key={index} className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
                        {turn.narration && (
                          <p className="leading-relaxed text-slate-100">{turn.narration}</p>
                        )}
                        {turn.actionsLog.length > 0 && (
                          <div className="space-y-2 text-xs text-slate-300">
                            {turn.actionsLog.map((action, actionIndex) => {
                              const effects = Array.isArray(action.effects) ? action.effects : [];
                              return (
                                <div
                                  key={`${index}-${actionIndex}`}
                                  className="rounded-xl border border-slate-800/80 bg-slate-950/40 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-sm font-semibold text-white">{action.role}</span>
                                    {action.choicePrompt && (
                                      <span className="text-xs text-slate-400">{action.choicePrompt}</span>
                                    )}
                                    {action.action && (
                                      <span className="text-xs text-slate-400">{action.action}</span>
                                    )}
                                  </div>
                                  {effects.length > 0 && (
                                    <div className="mt-1 text-right text-[11px] text-slate-400">
                                      {effects.join("，")}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                  <div ref={scrollAnchorRef} />
                </div>
              </ScrollArea>

              <div className="space-y-4 border-t border-slate-800 bg-slate-900/90 px-6 py-5 sticky bottom-0">
                {choices.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {choices.map((choice) => (
                      <Button
                        key={choice.id}
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="rounded-full border border-blue-400/40 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20"
                        onClick={() => setInput(choice.prompt)}
                      >
                        {choice.prompt}
                      </Button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-3">
                  <Textarea
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t("storyTurnPlaceholder")}
                    className="min-h-[120px] rounded-2xl border border-slate-800 bg-slate-950/60 text-white"
                  />
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs text-slate-500">
                      ⌘ + Enter / Ctrl + Enter
                    </span>
                    <Button type="submit" disabled={isPending} className="w-full sm:w-auto">
                      {isPending ? (
                        <span className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("sendAction")}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <Send className="h-4 w-4" />
                          {t("sendAction")}
                        </span>
                      )}
                    </Button>
                  </div>
                </form>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </GlobalLayout>
  );
};

export default StorySessionPage;

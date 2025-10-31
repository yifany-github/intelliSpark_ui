import { useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

interface StatePanelProps {
  state: Record<string, string>;
  className?: string;
  defaultOpen?: boolean;
}

const PRIMARY_KEYS = ["胸部", "下体", "衣服", "姿势", "情绪", "环境"];
const SAFE_KEYS = ["衣着", "仪态", "情绪", "环境", "动作", "语气"];
const KEY_ORDER = Array.from(new Set([...PRIMARY_KEYS, ...SAFE_KEYS]));

const ACCENTS = [
  {
    container: "bg-gradient-to-br from-rose-500/15 via-pink-500/10 to-transparent border-rose-400/30",
    label: "text-rose-100",
  },
  {
    container: "bg-gradient-to-br from-fuchsia-500/15 via-purple-500/10 to-transparent border-fuchsia-400/30",
    label: "text-fuchsia-100",
  },
  {
    container: "bg-gradient-to-br from-indigo-500/15 via-blue-500/10 to-transparent border-indigo-400/30",
    label: "text-indigo-100",
  },
  {
    container: "bg-gradient-to-br from-emerald-500/15 via-teal-500/10 to-transparent border-emerald-400/30",
    label: "text-emerald-100",
  },
  {
    container: "bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent border-amber-400/30",
    label: "text-amber-100",
  },
  {
    container: "bg-gradient-to-br from-sky-500/15 via-cyan-500/10 to-transparent border-sky-400/30",
    label: "text-sky-100",
  },
];

export const StatePanel = ({ state, className, defaultOpen = false }: StatePanelProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const orderedEntries = useMemo(() => {
    const entries = Object.entries(state).filter(([, value]) => value);
    entries.sort((a, b) => {
      const aIndex = KEY_ORDER.indexOf(a[0]);
      const bIndex = KEY_ORDER.indexOf(b[0]);
      const safeA = aIndex === -1 ? KEY_ORDER.length + 1 : aIndex;
      const safeB = bIndex === -1 ? KEY_ORDER.length + 1 : bIndex;
      return safeA - safeB;
    });
    return entries;
  }, [state]);

  const summary = useMemo(() => {
    const preferredKey = KEY_ORDER.find((key) => state[key]);
    const preview = preferredKey ? state[preferredKey] : orderedEntries[0]?.[1];
    if (!preview) return "";
    return preview.length > 46 ? `${preview.slice(0, 46)}…` : preview;
  }, [orderedEntries, state]);

  if (!orderedEntries.length) {
    return null;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-2xl border border-white/10 bg-white/5 px-3 py-2 backdrop-blur-sm",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/70">
            <Sparkles className="h-3 w-3 text-pink-200" />
            状态面板
          </div>
          {summary && (
            <span className="hidden truncate text-xs text-white/70 sm:block">
              {summary}
            </span>
          )}
        </div>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-2 py-1 text-[11px] font-medium text-white/80 transition hover:bg-white/20"
          >
            {open ? "收起" : "展开"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                open ? "rotate-180" : "",
              )}
            />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent className="mt-3 space-y-2">
        {orderedEntries.map(([key, value], index) => {
          const accent = ACCENTS[index % ACCENTS.length];
          return (
            <div
              key={key}
              className={cn(
                "rounded-2xl border px-3 py-3 text-sm leading-6 text-white/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]",
                accent.container,
              )}
            >
              <div className="flex items-center gap-2">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-white/60" aria-hidden />
                <span
                  className={cn(
                    "text-[12px] font-semibold uppercase tracking-[0.25em] text-white/70",
                    accent.label,
                  )}
                >
                  {key}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-7 text-white/95">
                {value}
              </p>
            </div>
          );
        })}
      </CollapsibleContent>
    </Collapsible>
  );
};

export default StatePanel;

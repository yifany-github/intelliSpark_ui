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
    beam: "from-rose-400/30 via-fuchsia-500/15 to-transparent",
    icon: "bg-rose-300/70",
    label: "text-rose-100",
    glow: "shadow-[0_0_25px_rgba(244,114,182,0.25)]",
  },
  {
    beam: "from-purple-400/30 via-indigo-500/15 to-transparent",
    icon: "bg-indigo-300/70",
    label: "text-indigo-100",
    glow: "shadow-[0_0_25px_rgba(165,180,252,0.25)]",
  },
  {
    beam: "from-blue-400/30 via-cyan-500/15 to-transparent",
    icon: "bg-sky-300/70",
    label: "text-sky-100",
    glow: "shadow-[0_0_25px_rgba(125,211,252,0.25)]",
  },
  {
    beam: "from-emerald-400/30 via-teal-500/15 to-transparent",
    icon: "bg-emerald-300/70",
    label: "text-emerald-100",
    glow: "shadow-[0_0_25px_rgba(52,211,153,0.25)]",
  },
  {
    beam: "from-amber-400/30 via-orange-500/15 to-transparent",
    icon: "bg-amber-300/70",
    label: "text-amber-100",
    glow: "shadow-[0_0_25px_rgba(253,230,138,0.25)]",
  },
  {
    beam: "from-pink-400/30 via-rose-500/15 to-transparent",
    icon: "bg-pink-300/70",
    label: "text-pink-100",
    glow: "shadow-[0_0_25px_rgba(244,114,182,0.2)]",
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

  // Removed confusing preview text - just show "状态面板" label

  if (!orderedEntries.length) {
    return null;
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className={cn(
        "rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-transparent px-3 py-3 backdrop-blur-md",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_8px_30px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/80">
          <Sparkles className="h-3 w-3 text-pink-200" />
          状态面板
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
      <CollapsibleContent className="mt-4 grid gap-3 sm:grid-cols-2">
        {orderedEntries.map(([key, value], index) => {
          const accent = ACCENTS[index % ACCENTS.length];
          return (
            <div
              key={key}
              className={cn("relative overflow-hidden rounded-3xl border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-xl transition hover:border-white/18", accent.glow)}
            >
              <div
                className={cn(
                  "pointer-events-none absolute inset-px rounded-[26px] bg-gradient-to-br opacity-80 blur-sm",
                  accent.beam,
                )}
                aria-hidden
              />
              <div className="flex items-center gap-2">
                <span className={cn("relative inline-flex h-2 w-2 rounded-full", accent.icon)} aria-hidden />
                <span className={cn("relative text-[13px] font-bold uppercase tracking-[0.22em] text-white", accent.label)}>
                  {key}
                </span>
              </div>
              <p className="relative mt-3 whitespace-pre-wrap text-[15px] leading-7 text-white/95">
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

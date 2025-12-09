import { useMemo } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// State value can be either a string (legacy) or an object with value and description
type StateValue = string | {
  value: number;
  description: string;
};

interface StatePanelProps {
  state: Record<string, StateValue>;
  className?: string;
}

const PRIMARY_KEYS = ["胸部", "下体", "衣服", "姿势", "情绪", "环境"];
const SAFE_KEYS = ["衣着", "仪态", "情绪", "环境", "动作", "语气"];
const QUANTIFIED_KEYS_ORDER = ["情绪", "好感度", "信任度", "兴奋度", "疲惫度", "欲望值", "敏感度"];
const KEY_ORDER = Array.from(new Set([...QUANTIFIED_KEYS_ORDER, ...PRIMARY_KEYS, ...SAFE_KEYS]));

// Quantifiable dimensions that should display progress bars
const QUANTIFIABLE_KEYS = new Set([
  "情绪", "心情", "好感度", "信任度", "兴奋度", "疲惫度",
  "欲望值", "敏感度", "紧张度", "愉悦度", "羞耻感"
]);

// Get color based on value (0-10 scale)
const getProgressColor = (value: number, key: string): { bar: string; bg: string; text: string } => {
  // Special handling for negative-connotation states
  const isNegative = ["疲惫度", "紧张度", "羞耻感"].includes(key);

  if (isNegative) {
    // For negative states, high values are bad (red), low values are good (green)
    if (value <= 3) return {
      bar: "bg-gradient-to-r from-emerald-500 to-green-500",
      bg: "bg-emerald-500/20",
      text: "text-emerald-300"
    };
    if (value <= 6) return {
      bar: "bg-gradient-to-r from-amber-500 to-orange-500",
      bg: "bg-amber-500/20",
      text: "text-amber-300"
    };
    return {
      bar: "bg-gradient-to-r from-red-500 to-rose-500",
      bg: "bg-red-500/20",
      text: "text-red-300"
    };
  } else {
    // For positive states, high values are good (green/blue), low values are concerning (red)
    if (value <= 3) return {
      bar: "bg-gradient-to-r from-red-500 to-rose-500",
      bg: "bg-red-500/20",
      text: "text-red-300"
    };
    if (value <= 6) return {
      bar: "bg-gradient-to-r from-amber-500 to-yellow-500",
      bg: "bg-amber-500/20",
      text: "text-amber-300"
    };
    return {
      bar: "bg-gradient-to-r from-blue-500 to-cyan-500",
      bg: "bg-blue-500/20",
      text: "text-blue-300"
    };
  }
};

// Check if a state value is quantified
const isQuantified = (value: StateValue): value is { value: number; description: string } => {
  return typeof value === 'object' && value !== null && 'value' in value && 'description' in value;
};

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

export const StatePanel = ({ state, className }: StatePanelProps) => {
  const orderedEntries = useMemo(() => {
    const entries = Object.entries(state).filter(([, value]) => {
      if (typeof value === 'string') return value.trim().length > 0;
      return value && ('value' in value || 'description' in value);
    });

    // 分离量化和描述性状态
    const quantified = entries.filter(([, value]) =>
      typeof value === 'object' && value !== null && 'value' in value
    );
    const descriptive = entries.filter(([, value]) =>
      typeof value === 'string'
    );

    // 分别排序
    const sortByOrder = (a: [string, any], b: [string, any]) => {
      const aIndex = KEY_ORDER.indexOf(a[0]);
      const bIndex = KEY_ORDER.indexOf(b[0]);
      const safeA = aIndex === -1 ? KEY_ORDER.length + 1 : aIndex;
      const safeB = bIndex === -1 ? KEY_ORDER.length + 1 : bIndex;
      return safeA - safeB;
    };

    quantified.sort(sortByOrder);
    descriptive.sort(sortByOrder);

    // 量化状态优先
    return [...quantified, ...descriptive];
  }, [state]);

  // Removed confusing preview text - just show "状态面板" label

  if (!orderedEntries.length) {
    return null;
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Simple title */}
      <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-white/60">
        <Sparkles className="h-3.5 w-3.5 text-pink-300" />
        <span>角色状态</span>
      </div>

      {/* Simplified state cards */}
      <div className="space-y-2.5">
        {orderedEntries.map(([key, value], index) => {
          const accent = ACCENTS[index % ACCENTS.length];
          const quantified = isQuantified(value);
          const displayValue = quantified ? value.value : null;
          const description = quantified ? value.description : (typeof value === 'string' ? value : '');
          const progressColor = displayValue !== null ? getProgressColor(displayValue, key) : null;

          return (
            <div
              key={key}
              className="relative rounded-xl border border-white/8 bg-white/5 px-3.5 py-3 backdrop-blur-sm transition hover:bg-white/8"
            >
              {/* Header with name and value */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", accent.icon)} />
                  <span className={cn("text-xs font-semibold", accent.label)}>
                    {key}
                  </span>
                </div>
                {displayValue !== null && progressColor && (
                  <span className={cn("text-xs font-bold tabular-nums", progressColor.text)}>
                    {displayValue}/10
                  </span>
                )}
              </div>

              {/* Progress bar for quantified states */}
              {displayValue !== null && progressColor && (
                <div className="mb-2.5">
                  <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500 ease-out", progressColor.bar)}
                      style={{ width: `${(displayValue / 10) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Description */}
              {description && (
                <p className="text-[13px] leading-relaxed text-white/85">
                  {description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StatePanel;

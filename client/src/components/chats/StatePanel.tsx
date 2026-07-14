import { useMemo, useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

// State value can be either a string (legacy) or an object with value and description
type StateValue = string | {
  value: number;
  description: string;
};

interface StatePanelProps {
  state: Record<string, StateValue>;
  className?: string;
}

// State key translations
const STATE_KEY_TRANSLATIONS: Record<string, { en: string; zh: string }> = {
  // NSFW keys
  "胸部": { en: "Chest", zh: "胸部" },
  "下体": { en: "Lower Body", zh: "下体" },
  "衣服": { en: "Clothing", zh: "衣服" },
  "姿势": { en: "Posture", zh: "姿势" },
  // Safe keys
  "衣着": { en: "Attire", zh: "衣着" },
  "仪态": { en: "Demeanor", zh: "仪态" },
  "动作": { en: "Action", zh: "动作" },
  "语气": { en: "Tone", zh: "语气" },
  // Common keys
  "情绪": { en: "Emotion", zh: "情绪" },
  "环境": { en: "Environment", zh: "环境" },
  "心情": { en: "Mood", zh: "心情" },
  "好感度": { en: "Affection", zh: "好感度" },
  "信任度": { en: "Trust", zh: "信任度" },
  "兴奋度": { en: "Excitement", zh: "兴奋度" },
  "疲惫度": { en: "Fatigue", zh: "疲惫度" },
  "欲望值": { en: "Desire", zh: "欲望值" },
  "敏感度": { en: "Sensitivity", zh: "敏感度" },
  "紧张度": { en: "Tension", zh: "紧张度" },
  "愉悦度": { en: "Pleasure", zh: "愉悦度" },
  "羞耻感": { en: "Shame", zh: "羞耻感" },
};

/** In-scene facts — default visible (continuity / immersion). */
const DIEGETIC_KEYS_ORDER = [
  "环境",
  "衣服",
  "衣着",
  "姿势",
  "仪态",
  "动作",
  "语气",
  "胸部",
  "下体",
];

/** RPG-style meters — collapsed by default (weak UX signal). */
const METRIC_KEYS_ORDER = [
  "情绪",
  "心情",
  "好感度",
  "信任度",
  "兴奋度",
  "疲惫度",
  "欲望值",
  "敏感度",
  "紧张度",
  "愉悦度",
  "羞耻感",
];

const METRIC_KEY_SET = new Set(METRIC_KEYS_ORDER);

const isMetaStateKey = (key: string) => key.startsWith("_");


const ACCENTS = [
  {
    icon: "bg-rose-300/70",
    label: "text-rose-100",
  },
  {
    icon: "bg-indigo-300/70",
    label: "text-indigo-100",
  },
  {
    icon: "bg-sky-300/70",
    label: "text-sky-100",
  },
  {
    icon: "bg-emerald-300/70",
    label: "text-emerald-100",
  },
  {
    icon: "bg-amber-300/70",
    label: "text-amber-100",
  },
  {
    icon: "bg-pink-300/70",
    label: "text-pink-100",
  },
];

const getProgressColor = (value: number, key: string): { bar: string; text: string } => {
  const isNegative = ["疲惫度", "紧张度", "羞耻感"].includes(key);

  if (isNegative) {
    if (value <= 3) return { bar: "bg-gradient-to-r from-emerald-500 to-green-500", text: "text-emerald-300" };
    if (value <= 6) return { bar: "bg-gradient-to-r from-amber-500 to-orange-500", text: "text-amber-300" };
    return { bar: "bg-gradient-to-r from-red-500 to-rose-500", text: "text-red-300" };
  }
  if (value <= 3) return { bar: "bg-gradient-to-r from-red-500 to-rose-500", text: "text-red-300" };
  if (value <= 6) return { bar: "bg-gradient-to-r from-amber-500 to-yellow-500", text: "text-amber-300" };
  return { bar: "bg-gradient-to-r from-blue-500 to-cyan-500", text: "text-blue-300" };
};

const isQuantified = (value: StateValue): value is { value: number; description: string } => {
  return typeof value === "object" && value !== null && "value" in value && "description" in value;
};

const hasContent = (value: StateValue): boolean => {
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value && ("value" in value || "description" in value));
};

const sortByOrder = (order: string[]) => (a: [string, StateValue], b: [string, StateValue]) => {
  const aIndex = order.indexOf(a[0]);
  const bIndex = order.indexOf(b[0]);
  const safeA = aIndex === -1 ? order.length + 1 : aIndex;
  const safeB = bIndex === -1 ? order.length + 1 : bIndex;
  return safeA - safeB;
};

const StateCard = ({
  stateKey,
  value,
  index,
  translateKey,
  showMeter,
}: {
  stateKey: string;
  value: StateValue;
  index: number;
  translateKey: (key: string) => string;
  showMeter: boolean;
}) => {
  const accent = ACCENTS[index % ACCENTS.length];
  const quantified = isQuantified(value);
  const displayValue = quantified && showMeter ? value.value : null;
  const description = quantified
    ? value.description
    : typeof value === "string"
      ? value
      : "";
  const progressColor = displayValue !== null ? getProgressColor(displayValue, stateKey) : null;

  return (
    <div className="relative rounded-xl border border-white/8 bg-white/5 px-3.5 py-3 backdrop-blur-sm transition hover:bg-white/8">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-1.5 w-1.5 rounded-full", accent.icon)} />
          <span className={cn("text-xs font-semibold", accent.label)}>
            {translateKey(stateKey)}
          </span>
        </div>
        {displayValue !== null && progressColor && (
          <span className={cn("text-xs font-bold tabular-nums", progressColor.text)}>
            {displayValue}/10
          </span>
        )}
      </div>

      {displayValue !== null && progressColor && (
        <div className="mb-2.5">
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div
              className={cn("h-full rounded-full transition-all duration-500 ease-out", progressColor.bar)}
              style={{ width: `${(displayValue / 10) * 100}%` }}
            />
          </div>
        </div>
      )}

      {description ? (
        <p className="text-[13px] leading-relaxed text-white/85">{description}</p>
      ) : null}
    </div>
  );
};

export const StatePanel = ({ state, className }: StatePanelProps) => {
  const { t, interfaceLanguage } = useLanguage();
  const [metricsOpen, setMetricsOpen] = useState(false);

  const translateKey = (key: string): string => {
    const translation = STATE_KEY_TRANSLATIONS[key];
    if (translation) {
      return interfaceLanguage === "en" ? translation.en : translation.zh;
    }
    return key;
  };

  const { diegeticEntries, metricEntries } = useMemo(() => {
    const entries = Object.entries(state).filter(
      ([key, value]) => !isMetaStateKey(key) && hasContent(value),
    );

    const diegetic = entries
      .filter(([key, value]) => {
        if (DIEGETIC_KEYS_ORDER.includes(key)) return true;
        // Unknown string fields count as scene facts
        if (!METRIC_KEY_SET.has(key) && typeof value === "string") return true;
        return false;
      })
      .sort(sortByOrder(DIEGETIC_KEYS_ORDER));

    const metrics = entries
      .filter(([key]) => METRIC_KEY_SET.has(key))
      .sort(sortByOrder(METRIC_KEYS_ORDER));

    return { diegeticEntries: diegetic, metricEntries: metrics };
  }, [state]);

  if (!diegeticEntries.length && !metricEntries.length) {
    return null;
  }

  const metricsLabel =
    interfaceLanguage === "en"
      ? `Meters (${metricEntries.length})`
      : `数值条（${metricEntries.length}）`;

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-1.5 px-1 text-[11px] font-medium text-white/60">
        <Sparkles className="h-3.5 w-3.5 text-pink-300" />
        <span>{t("chat.characterState")}</span>
      </div>

      {diegeticEntries.length > 0 ? (
        <div className="space-y-2.5">
          {diegeticEntries.map(([key, value], index) => (
            <StateCard
              key={key}
              stateKey={key}
              value={value}
              index={index}
              translateKey={translateKey}
              showMeter={false}
            />
          ))}
        </div>
      ) : null}

      {metricEntries.length > 0 ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMetricsOpen((open) => !open)}
            className="flex w-full items-center justify-between rounded-lg px-1 py-1.5 text-left text-[11px] font-medium text-white/45 transition hover:text-white/70"
            aria-expanded={metricsOpen}
          >
            <span>{metricsLabel}</span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                metricsOpen && "rotate-180",
              )}
            />
          </button>
          {metricsOpen ? (
            <div className="space-y-2.5">
              {metricEntries.map(([key, value], index) => (
                <StateCard
                  key={key}
                  stateKey={key}
                  value={value}
                  index={index}
                  translateKey={translateKey}
                  showMeter
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default StatePanel;

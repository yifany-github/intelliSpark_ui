import { useLanguage } from "@/contexts/LanguageContext";

/** Compact in-page 中文 | English control. Does not navigate between URLs. */
export function PageLanguageToggle() {
  const { language, setLanguage } = useLanguage();

  const btn = (code: "zh" | "en", label: string) => {
    const active = language === code;
    return (
      <button
        type="button"
        onClick={() => setLanguage(code)}
        aria-pressed={active}
        className={`px-4 py-2 text-sm font-medium transition ${
          active
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:text-foreground hover:bg-primary/10"
        }`}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="flex justify-center sm:justify-end mb-6">
      <div
        className="inline-flex items-center rounded-full border border-primary/40 bg-background/80 shadow-sm overflow-hidden"
        role="group"
        aria-label={language === "zh" ? "界面语言" : "Interface language"}
      >
        {btn("zh", "中文")}
        <span className="text-muted-foreground/60 select-none" aria-hidden>
          |
        </span>
        {btn("en", "English")}
      </div>
    </div>
  );
}

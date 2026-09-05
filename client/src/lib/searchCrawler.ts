/**
 * Known search / AI crawler user-agents.
 * Used to skip age-gate interstitial and auth boot UI so JS renderers
 * (Googlebot, Bing, etc.) keep the prerendered marketing content and meta.
 * Real browsers are never matched here.
 */
export const SEARCH_CRAWLER_UA =
  /Googlebot|Google-InspectionTool|Bingbot|DuckDuckBot|GPTBot|ChatGPT-User|ClaudeBot|PerplexityBot|Applebot|Bytespider|Baiduspider|YandexBot/i;

export function isSearchCrawler(): boolean {
  if (typeof navigator === "undefined") return false;
  return SEARCH_CRAWLER_UA.test(navigator.userAgent || "");
}
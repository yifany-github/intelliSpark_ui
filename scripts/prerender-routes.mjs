#!/usr/bin/env node
/**
 * Post-process the Vite SPA shell into one static HTML file per public URL.
 *
 * Cloudflare Pages serves about/index.html for /about (and character/4/index.html
 * for /character/4) on a direct hit. The same hashed JS/CSS stay in the file so
 * the React app still boots, wipes #root, and hydrates as a normal SPA.
 *
 * Character pages are filled from a build-time fetch of the public characters
 * API. Names, descriptions, and IDs are never invented. If the fetch fails,
 * this script exits non-zero after writing static routes so CI does not ship
 * homepage-canonical copies of /character/<id>.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist", "public");
const SITEMAP = path.join(ROOT, "client", "public", "sitemap.xml");
const SITE = "https://yychat.ai";
const HOME_TITLE = "YY Chat 歪歪｜韩国 18+ 漫画角色 AI 角色扮演聊天";
const HOME_DESCRIPTION =
  "YY Chat（歪歪）是面向 18+ 的网页版 AI 角色扮演。与精选韩国成人漫画角色实时聊天，沉浸式成人剧情。与 YY 直播、易歪歪无关。";
const DEFAULT_CHARACTERS_URL =
  "https://productinsightai-backend.fly.dev/api/characters";

const STATIC_ROUTES = {
  "/": {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    ogTitle: "YY Chat 歪歪｜韩国 18+ 漫画角色 AI 角色扮演",
    ogDescription:
      "与精选韩国 18+ 漫画角色实时聊天。网页版，无需自行部署酒馆或填写 API Key。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "YY Chat 歪歪｜韩国 18+ 漫画角色 AI 角色扮演",
    paragraphs: [
      "面向 18 岁及以上用户的网页版 AI 角色扮演。与精选韩国成人漫画角色实时聊天。中文优先，不用酒馆、不用 API Key。与 YY 直播、YY.com、JOYY、易歪歪无关。",
    ],
    hreflang: [
      { hreflang: "zh-CN", href: `${SITE}/` },
      { hreflang: "en", href: `${SITE}/?lang=en` },
      { hreflang: "x-default", href: `${SITE}/` },
    ],
    keepHomepageJsonLd: true,
  },
  "/characters": {
    title: "精选角色｜YY Chat 歪歪 18+ 韩漫 AI 角色扮演",
    description:
      "浏览 YY Chat（歪歪）精选约 80+ 韩国 18+ 漫画灵感角色。网页即可打开，不用酒馆、不用 API Key。仅限 18 岁及以上。",
    ogTitle: "精选角色｜YY Chat 歪歪",
    ogDescription: "约 80+ 精选韩国 18+ 漫画灵感角色。网页版 AI 角色扮演。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "精选 18+ 韩漫 AI 角色",
    paragraphs: [
      "探索下一段属于你的多角色故事。与精选的韩国 18+ 漫画角色实时聊天，体验沉浸式成人剧情。目录是精选约 80+，不是最大角色库。",
    ],
  },
  "/discover": {
    title: "发现角色｜YY Chat 歪歪 18+ AI 角色扮演",
    description:
      "在 YY Chat（歪歪）发现精选韩国 18+ 漫画灵感角色。网页版，中文优先，不用酒馆。仅限 18 岁及以上。",
    ogTitle: "发现角色｜YY Chat 歪歪",
    ogDescription: "发现精选 18+ 韩漫灵感角色。网页即可开始浏览。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "发现 18+ AI 角色",
    paragraphs: [
      "浏览精选韩国 18+ 漫画灵感角色。YY Chat（歪歪）是网页版 AI 角色扮演，中文优先，不用酒馆、不用 API Key。",
    ],
  },
  "/about": {
    title: "关于 YY Chat 歪歪｜18+ 韩漫 AI 角色扮演（非 YY 直播）",
    description:
      "YY Chat（歪歪，yychat.ai）是面向 18+ 的网页版 AI 角色扮演，和精选韩国成人漫画角色聊天。与 YY 直播、YY.com、易歪歪无关。",
    ogTitle: "关于 YY Chat 歪歪｜不是 YY 直播",
    ogDescription:
      "18+ 网页版 AI 角色扮演。韩漫角色，中文界面，不用酒馆和 API Key。与 YY 直播无关。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "关于 YY Chat",
    paragraphs: [
      "YY Chat（歪歪）是面向 18 岁及以上用户的网页版 AI 角色扮演。和精选韩国成人漫画角色聊沉浸式剧情。中文界面，网页即开。我们不是 YY 直播、YY.com、JOYY，也不是易歪歪。",
    ],
  },
  "/faq": {
    title: "常见问题｜YY Chat 歪歪 18+ AI 角色扮演",
    description:
      "YY Chat（歪歪）常见问题：这是网页版 18+ AI 角色扮演，精选约 80+ 韩漫角色，不用酒馆、不用 API Key。与 YY 直播无关。",
    ogTitle: "常见问题｜YY Chat 歪歪",
    ogDescription: "关于歪歪网页版 18+ AI 角色扮演、登录、年龄限制与角色目录的说明。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "常见问题",
    paragraphs: [
      "YY Chat（歪歪）是面向 18 岁及以上用户的网页版 AI 角色扮演。浏览角色页不必登录；开始聊天需要免费账号。不用安装 SillyTavern，也不用填写 API Key。与 YY 直播、易歪歪无关。",
    ],
  },
  "/character-ai-alternative": {
    title: "Character.AI Alternative | Uncensored AI Roleplay (YY Chat)",
    description:
      "YY Chat (歪歪, yychat.ai) is an 18+ Character.AI alternative for uncensored AI roleplay. Web app, no SillyTavern, no API key. 80+ curated Korean manhwa characters. Chat needs login; character pages are public.",
    ogTitle: "Character.AI Alternative | Uncensored AI Roleplay (YY Chat)",
    ogDescription:
      "18+ uncensored AI roleplay in the browser. No SillyTavern, no API key. 80+ curated Korean manhwa characters.",
    lang: "en",
    locale: "en_US",
    h1: "Character.AI Alternative for Uncensored AI Roleplay",
    paragraphs: [
      "YY Chat (歪歪) is a browser-based 18+ AI roleplay app. Talk with curated Korean manhwa-inspired characters without installing SillyTavern or pasting an API key.",
      "Character pages are public. Starting a chat still needs a free login. We are not YY Live, YY.com, JOYY, or 易歪歪. The catalog is about 80+ curated characters — not the largest library.",
    ],
    hreflang: [
      { hreflang: "en", href: `${SITE}/character-ai-alternative` },
      { hreflang: "zh-CN", href: `${SITE}/zhongwen-wu-shencha` },
      { hreflang: "x-default", href: `${SITE}/zhongwen-wu-shencha` },
    ],
  },
  "/zhongwen-wu-shencha": {
    title: "中文无审查 AI 角色扮演｜网页版不用酒馆｜歪歪 YY Chat",
    description:
      "歪歪（YY Chat，yychat.ai）是面向 18+ 的中文无审查 AI 角色扮演网页。不用酒馆、不用 API Key。精选 80+ 韩国成人漫画角色。角色页公开，聊天需登录。与 YY 直播、易歪歪无关。",
    ogTitle: "中文无审查 AI 角色扮演｜网页版不用酒馆｜歪歪 YY Chat",
    ogDescription:
      "18+ 中文无审查 AI 角色扮演网页。不用酒馆、不用 API Key。精选约 80+ 韩国成人漫画角色。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "中文无审查 AI 角色扮演",
    paragraphs: [
      "歪歪（YY Chat）是面向 18 岁及以上用户的网页版 AI 角色扮演。中文界面，精选韩国成人漫画风格角色。不用自己搭酒馆，也不用填写 API Key。",
      "角色页公开可看；开始聊天需要登录。我们不是 YY 直播、YY.com、JOYY，也不是易歪歪。目录是精选约 80+，不是最大角色库。",
    ],
    hreflang: [
      { hreflang: "en", href: `${SITE}/character-ai-alternative` },
      { hreflang: "zh-CN", href: `${SITE}/zhongwen-wu-shencha` },
      { hreflang: "x-default", href: `${SITE}/zhongwen-wu-shencha` },
    ],
  },
  "/privacy-policy": {
    title: "隐私政策 - yychat.ai",
    description:
      "YY Chat（歪歪，yychat.ai）隐私政策：说明我们如何收集、使用与保护个人信息。本服务仅向 18 岁及以上用户开放。",
    ogTitle: "隐私政策 - yychat.ai",
    ogDescription: "YY Chat（歪歪）隐私政策。仅向 18 岁及以上用户开放。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "YY Chat 隐私政策",
    paragraphs: [
      "本隐私政策旨在说明我们如何收集、使用、共享与保护您的个人信息，以及您如何行使相关权利。使用本服务即表示您同意本政策。若您不同意，请停止使用。",
    ],
  },
  "/terms-of-use": {
    title: "使用条款 - yychat.ai",
    description:
      "YY Chat（歪歪，yychat.ai）使用条款。本服务仅向 18 岁及以上成年人提供。法律页面地址为 /privacy-policy 与 /terms-of-use。",
    ogTitle: "使用条款 - yychat.ai",
    ogDescription: "YY Chat（歪歪）使用条款。仅向 18 岁及以上用户开放。",
    lang: "zh-CN",
    locale: "zh_CN",
    h1: "YY Chat 使用条款",
    paragraphs: [
      "当您访问、注册、创建或使用角色、进行聊天或内容生成、购买订阅或以其他方式使用本服务，即表示您已阅读、理解并同意受本条款约束。本服务仅向 18 岁及以上成年人提供。",
    ],
  },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function collapseText(value) {
  return String(value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].trim());
}

function urlToPathname(loc) {
  const url = new URL(loc);
  if (url.origin !== SITE) {
    throw new Error(`Sitemap loc is not ${SITE}: ${loc}`);
  }
  return url.pathname === "" ? "/" : url.pathname;
}

function fileForPath(pathname) {
  if (pathname === "/") return path.join(DIST, "index.html");
  return path.join(DIST, pathname.replace(/^\//, ""), "index.html");
}

function defaultHreflang(pathname) {
  const abs = pathname === "/" ? `${SITE}/` : `${SITE}${pathname}`;
  return [
    { hreflang: "zh-CN", href: abs },
    { hreflang: "en", href: `${abs}${abs.includes("?") ? "&" : "?"}lang=en` },
    { hreflang: "x-default", href: abs },
  ];
}

function replaceFirst(html, regex, replacement) {
  if (!regex.test(html)) return { html, ok: false };
  return { html: html.replace(regex, replacement), ok: true };
}

function setHtmlLang(html, lang) {
  if (/<html\b[^>]*\blang=/.test(html)) {
    return html.replace(/<html\b([^>]*)\blang=["'][^"']*["']/, `<html$1lang="${escapeHtml(lang)}"`);
  }
  return html.replace(/<html\b/, `<html lang="${escapeHtml(lang)}"`);
}

function setTitle(html, title) {
  const { html: next, ok } = replaceFirst(
    html,
    /<title>[\s\S]*?<\/title>/i,
    `<title>${escapeHtml(title)}</title>`,
  );
  if (ok) return next;
  return html.replace(/<\/head>/i, `    <title>${escapeHtml(title)}</title>\n  </head>`);
}

function setMeta(html, attr, key, content) {
  const quotedKey = escapeRe(key);
  const patterns = [
    new RegExp(
      `<meta\\s+[^>]*${attr}=["']${quotedKey}["'][^>]*>`,
      "i",
    ),
  ];
  const tag = `<meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  for (const re of patterns) {
    if (re.test(html)) return html.replace(re, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function setLinkRel(html, rel, href, extra = "") {
  const re = new RegExp(`<link\\s+[^>]*rel=["']${escapeRe(rel)}["'][^>]*>`, "i");
  const tag = `<link rel="${rel}" href="${escapeHtml(href)}"${extra} />`;
  if (re.test(html)) return html.replace(re, tag);
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function replaceHreflang(html, links) {
  let next = html.replace(
    /\s*<link\s+[^>]*(?:rel=["']alternate["'][^>]*hreflang=["'][^"']+["']|hreflang=["'][^"']+["'][^>]*rel=["']alternate["'])[^>]*>/gi,
    "",
  );
  const tags = links
    .map(
      (link) =>
        `<link rel="alternate" hreflang="${escapeHtml(link.hreflang)}" href="${escapeHtml(link.href)}" />`,
    )
    .join("\n    ");
  return next.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

function replaceJsonLd(html, json) {
  const tag = `<script type="application/ld+json">\n    ${JSON.stringify(json)}\n    </script>`;
  if (/<script type="application\/ld\+json">[\s\S]*?<\/script>/i.test(html)) {
    return html.replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/i, tag);
  }
  return html.replace(/<\/head>/i, `    ${tag}\n  </head>`);
}

function replaceRootAndNoscript(html, inner) {
  const open = html.match(/<div\s+id=["']root["'][^>]*>/i);
  if (!open) {
    throw new Error("Built index.html is missing <div id=\"root\">");
  }
  const start = open.index + open[0].length;
  const end = html.indexOf("</div>", start);
  if (end === -1) {
    throw new Error("Built index.html has an unclosed #root");
  }
  let next = `${html.slice(0, start)}\n      ${inner}\n    ${html.slice(end)}`;
  if (/<noscript>[\s\S]*?<\/noscript>/i.test(next)) {
    next = next.replace(/<noscript>[\s\S]*?<\/noscript>/i, `<noscript>\n      ${inner}\n    </noscript>`);
  } else {
    next = next.replace(/<\/body>/i, `    <noscript>\n      ${inner}\n    </noscript>\n  </body>`);
  }
  return next;
}

function prerenderInner(route) {
  const paragraphs = route.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("\n      ");
  return `<article data-yychat-prerender="1">
      <h1>${escapeHtml(route.h1)}</h1>
      ${paragraphs}
    </article>`;
}

function applyRoute(shell, pathname, route) {
  const canonical = pathname === "/" ? `${SITE}/` : `${SITE}${pathname}`;
  const hreflang = route.hreflang || defaultHreflang(pathname);
  let html = shell;
  html = setHtmlLang(html, route.lang);
  html = setTitle(html, route.title);
  html = setMeta(html, "name", "description", route.description);
  html = setLinkRel(html, "canonical", canonical);
  html = replaceHreflang(html, hreflang);
  html = setMeta(html, "property", "og:title", route.ogTitle || route.title);
  html = setMeta(html, "property", "og:description", route.ogDescription || route.description);
  html = setMeta(html, "property", "og:url", canonical);
  html = setMeta(html, "property", "og:locale", route.locale);
  html = setMeta(html, "property", "og:type", "website");
  html = setMeta(html, "name", "twitter:title", route.ogTitle || route.title);
  html = setMeta(html, "name", "twitter:description", route.ogDescription || route.description);
  if (!route.keepHomepageJsonLd) {
    html = replaceJsonLd(html, {
      "@context": "https://schema.org",
      "@type": "WebPage",
      url: canonical,
      name: route.title,
      description: route.description,
      inLanguage: route.lang,
      isPartOf: { "@id": `${SITE}/#app` },
    });
  }
  html = replaceRootAndNoscript(html, prerenderInner(route));
  return html;
}

function charactersUrl() {
  if (process.env.PRERENDER_CHARACTERS_URL) return process.env.PRERENDER_CHARACTERS_URL;
  if (process.env.VITE_API_BASE_URL) {
    return `${process.env.VITE_API_BASE_URL.replace(/\/$/, "")}/api/characters`;
  }
  return DEFAULT_CHARACTERS_URL;
}

async function fetchCharacters() {
  if (process.env.PRERENDER_SKIP_CHARACTERS === "1") {
    console.warn("PRERENDER_SKIP_CHARACTERS=1: skipping character pages (static routes only).");
    return [];
  }
  const url = charactersUrl();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  let response;
  try {
    response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json", "User-Agent": "yychat-prerender/1.0" },
    });
  } catch (error) {
    throw new Error(`Character API fetch failed (${url}): ${error.message}`);
  } finally {
    clearTimeout(timer);
  }
  if (!response.ok) {
    throw new Error(`Character API ${url} returned HTTP ${response.status}`);
  }
  const data = await response.json();
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.characters)
      ? data.characters
      : Array.isArray(data?.data)
        ? data.data
        : null;
  if (!list) {
    throw new Error("Character API did not return an array; refusing to invent character pages.");
  }
  const usable = [];
  for (const item of list) {
    const id = Number(item?.id);
    const name = collapseText(item?.name);
    if (!Number.isFinite(id) || id <= 0 || !name) continue;
    if (item?.isDeleted) continue;
    const description = collapseText(item.description || item.backstory);
    usable.push({ id, name, description });
  }
  if (usable.length === 0) {
    throw new Error("Character API returned no usable characters; refusing to invent pages.");
  }
  console.log(`Fetched ${usable.length} characters from ${url}`);
  return usable;
}

function characterRoute(character) {
  const title = `${character.name} · 18+ AI 角色扮演 | YY Chat 歪歪`;
  const fallback = `在 YY Chat 与 ${character.name} 进行 18+ AI 角色扮演聊天。韩国漫画风格角色，网页即可开始。`;
  const description = (
    character.description && character.description.length >= 40
      ? character.description
      : fallback
  ).slice(0, 160);
  const paragraphs = [
    fallback,
    character.description ? character.description.slice(0, 280) : null,
  ].filter(Boolean);
  return {
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    lang: "zh-CN",
    locale: "zh_CN",
    h1: character.name,
    paragraphs,
  };
}

async function main() {
  const shellPath = path.join(DIST, "index.html");
  let shell;
  try {
    shell = await readFile(shellPath, "utf8");
  } catch {
    throw new Error(`Missing ${shellPath}. Run vite build before prerender.`);
  }
  if (!/id=["']root["']/.test(shell)) {
    throw new Error("Built index.html is missing #root");
  }

  const sitemapXml = await readFile(SITEMAP, "utf8");
  const locs = parseSitemapLocs(sitemapXml);
  if (locs.length === 0) {
    throw new Error("sitemap.xml has no <loc> entries");
  }

  const sitemapPaths = locs.map(urlToPathname);
  const staticWritten = [];
  for (const pathname of sitemapPaths) {
    if (pathname.startsWith("/character/")) continue;
    const route = STATIC_ROUTES[pathname];
    if (!route) {
      throw new Error(`Sitemap path ${pathname} has no prerender copy. Add it to STATIC_ROUTES.`);
    }
    const html = applyRoute(shell, pathname, route);
    const out = fileForPath(pathname);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, html);
    staticWritten.push(pathname);
  }

  let characters;
  try {
    characters = await fetchCharacters();
  } catch (error) {
    console.error(error.message);
    console.error(
      "Static routes were written, but character pages were NOT generated. Refusing to finish a successful build.",
    );
    process.exitCode = 1;
    return;
  }

  const byId = new Map(characters.map((c) => [c.id, c]));
  const sitemapCharacterIds = sitemapPaths
    .filter((p) => p.startsWith("/character/"))
    .map((p) => Number(p.slice("/character/".length)));
  const missing = sitemapCharacterIds.filter((id) => !byId.has(id));
  if (missing.length && process.env.PRERENDER_SKIP_CHARACTERS !== "1") {
    console.error(
      `Sitemap character IDs missing from API (will not invent pages): ${missing.join(", ")}`,
    );
    process.exitCode = 1;
    return;
  }

  const characterWritten = [];
  for (const id of sitemapCharacterIds) {
    const character = byId.get(id);
    if (!character) continue;
    const pathname = `/character/${id}`;
    const html = applyRoute(shell, pathname, characterRoute(character));
    const out = fileForPath(pathname);
    await mkdir(path.dirname(out), { recursive: true });
    await writeFile(out, html);
    characterWritten.push(pathname);
  }

  console.log(
    `Prerendered ${staticWritten.length} static routes and ${characterWritten.length} character routes into ${DIST}`,
  );
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

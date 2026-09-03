#!/usr/bin/env node
/**
 * Fail the deploy if any sitemap URL's built HTML still looks like the homepage
 * (same canonical, same title, empty #root / no crawlable h1).
 */

import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = process.env.PRERENDER_DIST
  ? path.resolve(process.env.PRERENDER_DIST)
  : path.join(ROOT, "dist", "public");
const SITEMAP = path.join(ROOT, "client", "public", "sitemap.xml");
const SITE = "https://yychat.ai";
const HOME_TITLE = "YY Chat 歪歪｜韩国 18+ 漫画角色 AI 角色扮演聊天";
const HOME_CANONICAL = `${SITE}/`;

function parseSitemapLocs(xml) {
  return [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1].trim());
}

function locToFile(loc) {
  const url = new URL(loc);
  const pathname = url.pathname === "" ? "/" : url.pathname;
  if (pathname === "/") return path.join(DIST, "index.html");
  return path.join(DIST, pathname.replace(/^\//, ""), "index.html");
}

function decodeEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function attr(html, tagRe) {
  const match = html.match(tagRe);
  return match ? decodeEntities(match[1].trim()) : "";
}

function quotedAttr(html, ...regexes) {
  for (const re of regexes) {
    const match = html.match(re);
    if (match) return decodeEntities(match[1].trim());
  }
  return "";
}

function inner(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return decodeEntities(match[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const sitemapXml = await readFile(SITEMAP, "utf8");
  const locs = parseSitemapLocs(sitemapXml);
  if (locs.length === 0) {
    throw new Error("sitemap.xml has no <loc> entries");
  }

  const failures = [];
  for (const loc of locs) {
    const file = locToFile(loc);
    if (!(await exists(file))) {
      failures.push(`${loc}: missing ${path.relative(ROOT, file)}`);
      continue;
    }
    const html = await readFile(file, "utf8");
    const isHome = loc === HOME_CANONICAL || loc === SITE;
    const title = inner(html, "title");
    const canonical = quotedAttr(
      html,
      /<link\s+[^>]*rel=["']canonical["'][^>]*href="([^"]+)"/i,
      /<link\s+[^>]*rel=["']canonical["'][^>]*href='([^']+)'/i,
      /<link\s+[^>]*href="([^"]+)"[^>]*rel=["']canonical["']/i,
      /<link\s+[^>]*href='([^']+)'[^>]*rel=["']canonical["']/i,
    );
    const description = quotedAttr(
      html,
      /<meta\s+[^>]*name=["']description["'][^>]*content="([^"]*)"/i,
      /<meta\s+[^>]*name=["']description["'][^>]*content='([^']*)'/i,
      /<meta\s+[^>]*content="([^"]*)"[^>]*name=["']description["']/i,
      /<meta\s+[^>]*content='([^']*)'[^>]*name=["']description["']/i,
    );
    const ogUrl = quotedAttr(
      html,
      /<meta\s+[^>]*property=["']og:url["'][^>]*content="([^"]*)"/i,
      /<meta\s+[^>]*property=["']og:url["'][^>]*content='([^']*)'/i,
      /<meta\s+[^>]*content="([^"]*)"[^>]*property=["']og:url["']/i,
      /<meta\s+[^>]*content='([^']*)'[^>]*property=["']og:url["']/i,
    );
    const h1 = inner(html, "h1");
    const p = inner(html, "p");
    const rootMatch = html.match(/<div\s+id=["']root["'][^>]*>([\s\S]*?)<\/div>/i);
    const rootText = rootMatch
      ? decodeEntities(rootMatch[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim())
      : "";

    if (!canonical) {
      failures.push(`${loc}: missing canonical`);
    } else if (canonical !== loc && !(isHome && canonical === HOME_CANONICAL)) {
      failures.push(`${loc}: canonical is ${canonical}`);
    }
    if (!isHome && canonical === HOME_CANONICAL) {
      failures.push(`${loc}: still has homepage canonical`);
    }
    if (!title) {
      failures.push(`${loc}: missing <title>`);
    } else if (!isHome && title === HOME_TITLE) {
      failures.push(`${loc}: still has homepage title`);
    }
    if (!description || description.length < 20) {
      failures.push(`${loc}: missing or too-short meta description`);
    }
    if (ogUrl && ogUrl !== loc && !(isHome && ogUrl === HOME_CANONICAL)) {
      failures.push(`${loc}: og:url is ${ogUrl}`);
    }
    if (!h1 || h1.length < 2) {
      failures.push(`${loc}: missing meaningful <h1>`);
    } else if (!isHome && h1 === HOME_TITLE) {
      failures.push(`${loc}: <h1> is still the homepage heading`);
    }
    if (!p || p.length < 20) {
      failures.push(`${loc}: missing meaningful body <p>`);
    }
    if (!rootText || rootText.length < 20) {
      failures.push(`${loc}: #root has no crawlable text (SPA shell only)`);
    }
  }

  if (failures.length) {
    console.error(`Prerender verification failed (${failures.length} issue(s)):`);
    for (const line of failures) console.error(`  - ${line}`);
    process.exit(1);
  }

  console.log(`OK: ${locs.length} sitemap URLs have route-specific title, canonical, h1, and body text in ${DIST}`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});

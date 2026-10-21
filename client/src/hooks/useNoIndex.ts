import { useEffect } from "react";

/**
 * Adds <meta name="robots" content="noindex,follow"> while the calling page is
 * mounted and restores the previous state on unmount, so client-side navigation
 * to other routes never carries a stale noindex.
 */
export function useNoIndex(content = "noindex,follow") {
  useEffect(() => {
    const existing = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previous = existing?.getAttribute("content") ?? null;
    const tag = existing ?? document.createElement("meta");
    tag.setAttribute("name", "robots");
    tag.setAttribute("content", content);
    if (!existing) document.head.appendChild(tag);
    return () => {
      if (existing && previous !== null) existing.setAttribute("content", previous);
      else tag.remove();
    };
  }, [content]);
}

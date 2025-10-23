import { useEffect, useMemo, useRef, useState, ReactNode, isValidElement, cloneElement } from "react";
import { cn } from "@/lib/utils";

interface ChatListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  initialBatchSize?: number;
  batchIncrement?: number;
  className?: string;
  emptyState?: React.ReactNode;
}

/**
 * Progressive chat list renderer that keeps initial paint small and streams
 * additional items in as the user scrolls. This avoids rendering dozens of
 * chat cards at once while keeping the interaction lightweight.
 */
export function ChatList<T>({
  items,
  renderItem,
  initialBatchSize = 9,
  batchIncrement = 6,
  className,
  emptyState = null,
}: ChatListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(initialBatchSize);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible count whenever the collection changes substantially
  useEffect(() => {
    setVisibleCount(initialBatchSize);
  }, [items, initialBatchSize]);

  const displayedItems = useMemo(
    () => items.slice(0, visibleCount),
    [items, visibleCount]
  );

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (!entry?.isIntersecting) {
          return;
        }

        setVisibleCount((current) => {
          if (current >= items.length) {
            observer.disconnect();
            return current;
          }
          return Math.min(items.length, current + batchIncrement);
        });
      },
      {
        rootMargin: "200px",
        threshold: 0.1,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [items.length, batchIncrement]);

  if (items.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div className={cn(className)}>
        {displayedItems.map((item, index) => {
          const element = renderItem(item, index);
          if (isValidElement(element) && element.key == null) {
            const fallbackKey =
              typeof item === "object" && item !== null && "id" in (item as Record<string, unknown>)
                ? String((item as Record<string, unknown>).id)
                : String(index);
            return cloneElement(element, { key: fallbackKey });
          }
          return element;
        })}
      </div>
      <div ref={sentinelRef} aria-hidden className="h-1 w-full" />
    </>
  );
}

export default ChatList;

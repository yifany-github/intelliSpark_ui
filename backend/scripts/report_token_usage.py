"""Quick report for opening-line token consumption."""

import argparse
import math
from statistics import mean

from database import SessionLocal
from models import ChatMessage


def approximate_tokens(text: str) -> int:
    """Rudimentary token estimate (~4 characters per token)."""
    text = text or ""
    return max(1, math.ceil(len(text) / 4))


def collect_opening_line_tokens() -> list[int]:
    session = SessionLocal()
    try:
        openings: list[int] = []
        seen_chats: set[int] = set()

        query = (
            session.query(ChatMessage)
            .order_by(ChatMessage.chat_id, ChatMessage.id)
        )

        for message in query:
            if message.chat_id in seen_chats:
                continue
            if message.role != "assistant":
                continue
            openings.append(approximate_tokens(message.content))
            seen_chats.add(message.chat_id)

        return openings
    finally:
        session.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Report opening line token usage")
    parser.add_argument(
        "--baseline",
        type=float,
        default=None,
        help="Baseline average tokens before caching (from historical report).",
    )
    args = parser.parse_args()

    samples = collect_opening_line_tokens()
    if not samples:
        print("No opening line messages found."
              " Ensure chats exist before running this report.")
        return

    current_avg = mean(samples)
    print(f"Current average opening line tokens: {current_avg:.2f}")

    if args.baseline is not None:
        savings = args.baseline - current_avg
        pct = (savings / args.baseline * 100) if args.baseline else 0.0
        print(f"Baseline tokens: {args.baseline:.2f}")
        print(f"Estimated savings: {savings:.2f} tokens ({pct:.1f}%)")
    else:
        print("Provide --baseline to compute savings compared to historical data.")


if __name__ == "__main__":
    main()

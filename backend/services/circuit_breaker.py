"""Asynchronous circuit breaker for chat generation retries."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from enum import Enum
from typing import Callable, Dict, Optional


class BreakerState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class BreakerStatus:
    blocked: bool
    state: BreakerState
    retry_after: Optional[float] = None


@dataclass
class BreakerContext:
    failures: int = 0
    state: BreakerState = BreakerState.CLOSED
    next_attempt: Optional[float] = None


class CircuitBreaker:
    def __init__(
        self,
        *,
        max_failures: int = 5,
        reset_timeout: float = 30.0,
        clock: Callable[[], float] | None = None,
    ):
        self.max_failures = max_failures
        self.reset_timeout = reset_timeout
        self._clock = clock or time.monotonic
        self._contexts: Dict[str, BreakerContext] = {}
        self._locks: Dict[str, asyncio.Lock] = {}

    def _get_lock(self, key: str) -> asyncio.Lock:
        if key not in self._locks:
            self._locks[key] = asyncio.Lock()
        return self._locks[key]

    def _get_context(self, key: str) -> BreakerContext:
        if key not in self._contexts:
            self._contexts[key] = BreakerContext()
        return self._contexts[key]

    async def before_call(self, key: str) -> BreakerStatus:
        lock = self._get_lock(key)
        async with lock:
            ctx = self._get_context(key)
            now = self._clock()

            if ctx.state == BreakerState.OPEN:
                if ctx.next_attempt and now >= ctx.next_attempt:
                    ctx.state = BreakerState.HALF_OPEN
                    return BreakerStatus(blocked=False, state=BreakerState.HALF_OPEN)

                retry_after = max(0.0, (ctx.next_attempt or now) - now)
                return BreakerStatus(
                    blocked=True,
                    state=BreakerState.OPEN,
                    retry_after=retry_after,
                )

            return BreakerStatus(blocked=False, state=ctx.state)

    async def after_success(self, key: str) -> BreakerStatus:
        lock = self._get_lock(key)
        async with lock:
            ctx = self._get_context(key)
            ctx.failures = 0
            ctx.state = BreakerState.CLOSED
            ctx.next_attempt = None
            return BreakerStatus(blocked=False, state=BreakerState.CLOSED)

    async def after_failure(self, key: str) -> BreakerStatus:
        lock = self._get_lock(key)
        async with lock:
            ctx = self._get_context(key)
            now = self._clock()

            # Failure while half-open immediately re-opens the breaker
            if ctx.state == BreakerState.HALF_OPEN:
                ctx.state = BreakerState.OPEN
                ctx.failures = self.max_failures
                ctx.next_attempt = now + self.reset_timeout
                return BreakerStatus(
                    blocked=True,
                    state=BreakerState.OPEN,
                    retry_after=self.reset_timeout,
                )

            ctx.failures += 1

            if ctx.failures >= self.max_failures:
                ctx.state = BreakerState.OPEN
                ctx.next_attempt = now + self.reset_timeout
                return BreakerStatus(
                    blocked=True,
                    state=BreakerState.OPEN,
                    retry_after=self.reset_timeout,
                )

            ctx.state = BreakerState.CLOSED
            ctx.next_attempt = None
            return BreakerStatus(blocked=False, state=BreakerState.CLOSED)

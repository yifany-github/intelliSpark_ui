import pytest

from backend.services.circuit_breaker import CircuitBreaker, BreakerState


class FakeClock:
    def __init__(self, start: float = 0.0):
        self.value = start

    def advance(self, delta: float) -> None:
        self.value += delta

    def __call__(self) -> float:
        return self.value


@pytest.mark.asyncio
async def test_circuit_breaker_transitions_and_timing():
    clock = FakeClock()
    breaker = CircuitBreaker(max_failures=3, reset_timeout=5.0, clock=clock)

    # Closed state allows calls
    status = await breaker.before_call("chat-1")
    assert status.blocked is False
    assert status.state == BreakerState.CLOSED

    # Failures increment until breaker opens
    await breaker.after_failure("chat-1")
    await breaker.after_failure("chat-1")
    final_failure = await breaker.after_failure("chat-1")

    assert final_failure.blocked is True
    assert final_failure.state == BreakerState.OPEN
    assert pytest.approx(final_failure.retry_after, rel=0.01) == 5.0

    # Calls are blocked while open
    blocked = await breaker.before_call("chat-1")
    assert blocked.blocked is True
    assert blocked.state == BreakerState.OPEN
    assert blocked.retry_after is not None

    # After timeout the breaker moves to half-open
    clock.advance(5.0)
    half_open = await breaker.before_call("chat-1")
    assert half_open.blocked is False
    assert half_open.state == BreakerState.HALF_OPEN

    # Failure in half-open re-opens the breaker
    reopened = await breaker.after_failure("chat-1")
    assert reopened.blocked is True
    assert reopened.state == BreakerState.OPEN

    # Success after cooldown resets to closed
    clock.advance(5.0)
    half_open_again = await breaker.before_call("chat-1")
    assert half_open_again.blocked is False
    assert half_open_again.state == BreakerState.HALF_OPEN

    await breaker.after_success("chat-1")
    closed = await breaker.before_call("chat-1")
    assert closed.blocked is False
    assert closed.state == BreakerState.CLOSED

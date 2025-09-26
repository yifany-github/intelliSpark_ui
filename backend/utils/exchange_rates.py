import logging
import time
from decimal import Decimal, ROUND_HALF_UP, InvalidOperation
from typing import Callable, Optional, Tuple

import requests

from config import settings

logger = logging.getLogger(__name__)

_DEFAULT_PRIMARY_URL = "https://api.exchangerate.host/latest"
_SECONDARY_URL = "https://open.er-api.com/v6/latest/USD"
_cached_rate: Optional[Decimal] = None
_cached_at: Optional[float] = None


def _get_cache_ttl() -> int:
    return getattr(settings, "fx_rate_cache_ttl_seconds", None) or 86400


def _get_default_rate() -> Decimal:
    default_rate = getattr(settings, "fx_default_usd_cny_rate", None) or 7.2
    return Decimal(str(default_rate))


def _extract_rate(payload: dict) -> Decimal:
    if not isinstance(payload, dict):
        raise ValueError("Unexpected exchange rate payload type")

    if "rates" in payload and isinstance(payload["rates"], dict):
        rates = payload["rates"]
        if "CNY" in rates:
            return Decimal(str(rates["CNY"]))
    if "conversion_rates" in payload and isinstance(payload["conversion_rates"], dict):
        rates = payload["conversion_rates"]
        if "CNY" in rates:
            return Decimal(str(rates["CNY"]))
    if "result" in payload:
        value = payload.get("result")
        if value is not None and value != "error":
            try:
                return Decimal(str(value))
            except (InvalidOperation, TypeError) as exc:
                raise ValueError("Unable to parse result field as Decimal") from exc
    raise ValueError("CNY rate missing from exchange rate response")


def _primary_provider() -> Decimal:
    api_url = getattr(settings, "fx_rate_api_url", None) or _DEFAULT_PRIMARY_URL
    timeout = getattr(settings, "fx_rate_api_timeout_seconds", None) or 5
    response = requests.get(
        api_url,
        params={"base": "USD", "symbols": "CNY", "from": "USD", "to": "CNY"},
        timeout=timeout,
    )
    response.raise_for_status()
    data = response.json() or {}
    rate = _extract_rate(data)
    logger.debug("Fetched USD→CNY rate %.6f from primary provider", float(rate))
    return rate


def _secondary_provider() -> Decimal:
    timeout = getattr(settings, "fx_rate_api_timeout_seconds", None) or 5
    response = requests.get(_SECONDARY_URL, timeout=timeout)
    response.raise_for_status()
    data = response.json() or {}
    # open.er-api.com uses 'result' to indicate success
    if data.get("result") != "success":
        raise ValueError(f"Secondary provider returned {data.get('result')}")
    rate = _extract_rate(data)
    logger.debug("Fetched USD→CNY rate %.6f from secondary provider", float(rate))
    return rate


def _fetch_rate_from_api() -> Decimal:
    providers: Tuple[Callable[[], Decimal], ...] = (_primary_provider, _secondary_provider)
    errors = []
    for provider in providers:
        try:
            return provider()
        except Exception as exc:  # noqa: BLE001
            provider_name = provider.__name__
            logger.warning("FX provider %s failed: %s", provider_name, exc)
            errors.append(f"{provider_name}: {exc}")
    raise ValueError("All FX providers failed: " + " | ".join(errors))


def get_usd_to_cny_rate(force_refresh: bool = False) -> Decimal:
    """Return the USD→CNY rate with simple in-memory caching."""
    global _cached_at, _cached_rate

    override = getattr(settings, "fx_usd_cny_rate_override", None)
    if override is not None:
        return Decimal(str(override))

    now = time.time()
    ttl = _get_cache_ttl()

    if (
        not force_refresh
        and _cached_rate is not None
        and _cached_at is not None
        and now - _cached_at < ttl
    ):
        return _cached_rate

    try:
        rate = _fetch_rate_from_api()
        _cached_rate = rate
        _cached_at = now
        return rate
    except Exception as exc:  # noqa: BLE001
        logger.warning("Falling back to cached/default USD→CNY rate: %s", exc)
        if _cached_rate is not None:
            return _cached_rate
        fallback = _get_default_rate()
        _cached_rate = fallback
        _cached_at = now
        return fallback


def convert_usd_cents_to_cny_fen(amount_cents: int) -> Tuple[int, Decimal]:
    """Convert an amount denominated in USD cents to CNY fen using the live rate."""
    if amount_cents < 0:
        raise ValueError("Amount must be non-negative")

    rate = get_usd_to_cny_rate().normalize()
    converted = (Decimal(amount_cents) * rate).quantize(Decimal("1"), rounding=ROUND_HALF_UP)
    return int(converted), rate

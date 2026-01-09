from datetime import datetime, timezone
from typing import Optional


def format_datetime(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    if value.tzinfo is None or value.tzinfo.utcoffset(value) is None:
        return value.isoformat() + "Z"
    utc_value = value.astimezone(timezone.utc)
    return utc_value.replace(tzinfo=None).isoformat() + "Z"

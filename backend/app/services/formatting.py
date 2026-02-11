from __future__ import annotations

from datetime import timedelta


def format_duration(seconds: int | None) -> str:
    if seconds is None:
        return "00:00"
    seconds = int(seconds)
    dt = timedelta(seconds=seconds)
    total_minutes, secs = divmod(dt.seconds, 60)
    hours, minutes = divmod(total_minutes, 60)
    if dt.days or hours:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    return f"{minutes:02d}:{secs:02d}"


def format_views(views: int | None) -> str:
    if not views:
        return "0"
    views = int(views)
    for divisor, suffix in ((1_000_000_000, "B"), (1_000_000, "M"), (1_000, "K")):
        if views >= divisor:
            return f"{views / divisor:.1f}{suffix}"
    return str(views)


def format_speed(bytes_per_sec: float | None) -> str:
    if not bytes_per_sec:
        return "0 B/s"
    units = ["B/s", "KB/s", "MB/s", "GB/s"]
    unit_index = 0
    while bytes_per_sec >= 1024 and unit_index < len(units) - 1:
        bytes_per_sec /= 1024
        unit_index += 1
    return f"{bytes_per_sec:.1f} {units[unit_index]}"



"""file_counter — aggregate counts and totals across a file inventory."""

from collections import Counter


def run(state):
    files = state.get("workspace", {}).get("files", [])
    if not files:
        return {"tool": "file_counter", "ok": True, "count": 0, "by_type": {}, "total_bytes": 0}

    types = Counter(entry.get("type", "unknown") for entry in files)
    total_bytes = sum(entry.get("size_bytes", 0) for entry in files)
    largest = max(files, key=lambda e: e.get("size_bytes", 0))

    return {
        "tool": "file_counter",
        "ok": True,
        "count": len(files),
        "by_type": dict(types),
        "total_bytes": total_bytes,
        "largest": {"name": largest["name"], "size_bytes": largest.get("size_bytes", 0)},
    }

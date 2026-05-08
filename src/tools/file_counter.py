"""file_counter — aggregate counts and totals across the real workspace."""

from collections import Counter


def run(state):
    files = state.get("workspace", {}).get("files", [])
    if not files:
        return {
            "tool": "file_counter", "ok": True,
            "count": 0, "by_ext": {}, "total_bytes": 0,
        }

    ext_counts = Counter((f.get("ext") or "?").lower() for f in files)
    mime_counts = Counter((f.get("mime") or "?").split(";")[0].strip() for f in files)
    total_bytes = sum(int(f.get("size_bytes", 0)) for f in files)
    text_count = sum(1 for f in files if f.get("text") is not None)

    largest = max(files, key=lambda f: int(f.get("size_bytes", 0)))

    return {
        "tool": "file_counter",
        "ok": True,
        "count": len(files),
        "by_ext": dict(ext_counts),
        "by_mime": dict(mime_counts),
        "total_bytes": total_bytes,
        "text_files": text_count,
        "binary_files": len(files) - text_count,
        "largest": {
            "name": largest.get("name"),
            "size_bytes": int(largest.get("size_bytes", 0)),
        },
    }

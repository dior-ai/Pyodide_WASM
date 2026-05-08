"""file_inspector — list files from the simulated workspace with size + type."""


def _human_size(num_bytes: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if num_bytes < 1024:
            return f"{num_bytes:.1f} {unit}"
        num_bytes /= 1024
    return f"{num_bytes:.1f} TB"


def run(state):
    files = state.get("workspace", {}).get("files", [])
    inspected = []
    for entry in files:
        inspected.append({
            "name": entry["name"],
            "type": entry.get("type", "unknown"),
            "size_bytes": entry.get("size_bytes", 0),
            "size_human": _human_size(entry.get("size_bytes", 0)),
            "modified": entry.get("modified"),
        })

    inspected.sort(key=lambda f: f["size_bytes"], reverse=True)

    return {
        "tool": "file_inspector",
        "ok": True,
        "files": inspected,
        "count": len(inspected),
    }

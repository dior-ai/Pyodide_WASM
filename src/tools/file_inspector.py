"""file_inspector — real metadata + content sniffing on the user's files."""


def _human_size(num_bytes: int) -> str:
    n = float(num_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


_LANG_BY_EXT = {
    "py": "python", "js": "javascript", "ts": "typescript", "tsx": "typescript",
    "jsx": "javascript", "rs": "rust", "go": "go", "java": "java", "rb": "ruby",
    "css": "stylesheet", "html": "markup", "md": "markdown", "rst": "documentation",
    "csv": "tabular", "tsv": "tabular", "json": "structured", "yaml": "config",
    "yml": "config", "toml": "config", "ini": "config", "log": "log", "txt": "text",
}


def run(state):
    files = state.get("workspace", {}).get("files", [])
    inspected = []

    for f in files:
        ext = (f.get("ext") or "").lower()
        text = f.get("text")
        preview = None
        line_count = None

        if isinstance(text, str) and text:
            line_count = text.count("\n") + (0 if text.endswith("\n") else 1)
            head = text[:240].replace("\r", "")
            if "\n" in head:
                head = head[: head.index("\n")]
            preview = head

        inspected.append({
            "name": f.get("name"),
            "ext": ext,
            "language": _LANG_BY_EXT.get(ext, "binary" if not text else "text"),
            "mime": f.get("mime"),
            "size_bytes": f.get("size_bytes", 0),
            "size_human": _human_size(f.get("size_bytes", 0)),
            "line_count": line_count,
            "preview": preview,
            "is_text": text is not None,
            "truncated": bool(f.get("text_truncated")),
        })

    inspected.sort(key=lambda x: x["size_bytes"], reverse=True)

    return {
        "tool": "file_inspector",
        "ok": True,
        "count": len(inspected),
        "files": inspected,
    }

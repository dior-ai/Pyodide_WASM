"""summarizer — generate a human-readable summary from prior tool outputs."""


def _format_bytes(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def run(state):
    history = state.get("tool_history", [])
    inspector = next(
        (h for h in history if h.get("tool") == "file_inspector"), None
    )
    counter = next(
        (h for h in history if h.get("tool") == "file_counter"), None
    )

    lines = []
    if inspector:
        files = inspector.get("output", {}).get("files", [])
        lines.append(f"Inspected {len(files)} files in the workspace.")
        if files:
            top = files[:3]
            preview = ", ".join(f"{f['name']} ({f['size_human']})" for f in top)
            lines.append(f"Largest: {preview}.")

    if counter:
        out = counter.get("output", {})
        by_type = out.get("by_type", {})
        if by_type:
            type_str = ", ".join(f"{n} {t}" for t, n in by_type.items())
            lines.append(f"Composition: {type_str}.")
        if out.get("total_bytes"):
            lines.append(f"Combined size: {_format_bytes(out['total_bytes'])}.")
        if out.get("largest"):
            largest = out["largest"]
            lines.append(
                f"Heaviest artifact is {largest['name']} "
                f"at {_format_bytes(largest['size_bytes'])}."
            )

    if not lines:
        lines.append("No prior tool outputs were available to summarize.")

    headline = lines[0] if lines else "Workspace analyzed."
    summary = " ".join(lines)

    return {
        "tool": "summarizer",
        "ok": True,
        "headline": headline,
        "summary": summary,
        "bullets": lines,
    }

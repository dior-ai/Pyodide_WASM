"""summarizer — synthesize a human-readable narrative from prior tool outputs."""


def _format_bytes(n):
    n = float(n)
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} TB"


def _find(history, tool):
    for h in history:
        if h.get("tool") == tool:
            return h.get("output", {})
    return None


def run(state):
    history = state.get("tool_history", [])
    inspector = _find(history, "file_inspector")
    counter = _find(history, "file_counter")
    json_v = _find(history, "json_validator")
    text = _find(history, "text_analyzer")
    csv = _find(history, "csv_analyzer")

    parts = []

    if counter:
        parts.append(
            f"Workspace contains {counter.get('count', 0)} file"
            f"{'s' if counter.get('count', 0) != 1 else ''} "
            f"({counter.get('text_files', 0)} text, "
            f"{counter.get('binary_files', 0)} binary), "
            f"totaling {_format_bytes(counter.get('total_bytes', 0))}."
        )
        by_ext = counter.get("by_ext", {})
        if by_ext:
            kinds = ", ".join(f"{n} .{e}" for e, n in sorted(by_ext.items(), key=lambda kv: -kv[1]))
            parts.append(f"Composition: {kinds}.")
        largest = counter.get("largest")
        if largest:
            parts.append(
                f"Heaviest file is {largest.get('name')} "
                f"({_format_bytes(largest.get('size_bytes', 0))})."
            )

    if json_v and json_v.get("checked"):
        parts.append(
            f"Validated {json_v['checked']} JSON file(s): "
            f"{json_v.get('valid', 0)} parsed cleanly, "
            f"{json_v.get('invalid', 0)} had errors."
        )
        for entry in json_v.get("files", []):
            shape = entry.get("shape") or {}
            if entry.get("valid") and shape.get("kind") == "object":
                parts.append(
                    f"{entry['name']} → object with {shape.get('key_count')} top-level keys, "
                    f"depth {shape.get('depth')}."
                )

    if csv and csv.get("analyzed"):
        for entry in csv.get("files", []):
            if entry.get("ok"):
                parts.append(
                    f"{entry['name']} → {entry.get('rows', 0)} rows × "
                    f"{entry.get('cols', 0)} columns. "
                    f"Numeric columns: {len(entry.get('numeric', {}))}, "
                    f"categoricals: {len(entry.get('categorical', {}))}."
                )

    if text and text.get("analyzed"):
        totals = text.get("totals", {})
        parts.append(
            f"Across {text['analyzed']} text file(s): {totals.get('words', 0)} words, "
            f"{totals.get('sentences', 0)} sentences, "
            f"~{totals.get('reading_minutes', 0)} min reading time."
        )
        kw = text.get("top_keywords") or []
        if kw:
            top = ", ".join(f"{k['word']} ({k['count']})" for k in kw[:5])
            parts.append(f"Top keywords: {top}.")

    if inspector and not (counter or csv or text or json_v):
        parts.append(
            f"Inspected {inspector.get('count', 0)} file(s) — supply more "
            f"specific tasks (e.g. 'summarize the markdown', 'analyze CSVs') "
            f"to engage richer analysis tools."
        )

    if not parts:
        parts.append("No prior tool outputs were available to summarize.")

    headline = parts[0]
    summary = " ".join(parts)

    return {
        "tool": "summarizer",
        "ok": True,
        "headline": headline,
        "summary": summary,
        "bullets": parts,
    }

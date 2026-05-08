"""json_validator — parse and characterize every JSON file in the workspace."""

import json


def _shape(value, depth=0):
    if isinstance(value, dict):
        deepest = depth
        for v in value.values():
            child = _shape(v, depth + 1)
            if child["depth"] > deepest:
                deepest = child["depth"]
        return {
            "kind": "object",
            "keys": list(value.keys())[:12],
            "key_count": len(value),
            "depth": deepest,
        }
    if isinstance(value, list):
        if not value:
            return {"kind": "array", "length": 0, "depth": depth}
        sample = _shape(value[0], depth + 1)
        return {
            "kind": "array",
            "length": len(value),
            "item_kind": sample["kind"],
            "depth": sample["depth"],
        }
    if isinstance(value, bool):
        return {"kind": "bool", "depth": depth}
    if isinstance(value, (int, float)):
        return {"kind": "number", "depth": depth}
    if value is None:
        return {"kind": "null", "depth": depth}
    return {"kind": "string", "depth": depth}


def run(state):
    files = state.get("workspace", {}).get("files", [])
    json_files = [f for f in files if (f.get("ext") or "").lower() == "json"]

    if not json_files:
        return {
            "tool": "json_validator",
            "ok": True,
            "checked": 0,
            "files": [],
            "note": "No JSON files in workspace.",
        }

    results = []
    for f in json_files:
        text = f.get("text") or ""
        entry = {
            "name": f.get("name"),
            "size_bytes": f.get("size_bytes", 0),
            "valid": False,
            "error": None,
            "shape": None,
        }
        try:
            parsed = json.loads(text)
            entry["valid"] = True
            entry["shape"] = _shape(parsed)
        except json.JSONDecodeError as e:
            entry["error"] = f"{e.msg} at line {e.lineno}, col {e.colno}"
        results.append(entry)

    valid = sum(1 for r in results if r["valid"])
    return {
        "tool": "json_validator",
        "ok": True,
        "checked": len(results),
        "valid": valid,
        "invalid": len(results) - valid,
        "files": results,
    }

"""csv_analyzer — real pandas-powered analysis of every CSV in the workspace."""

import io
import json as _json

import pandas as pd  # installed lazily by the JS-side ensurePackage("pandas")


def _summarize_frame(df):
    rows, cols = df.shape
    dtypes = {c: str(t) for c, t in df.dtypes.items()}

    numeric = df.select_dtypes(include="number")
    numeric_summary = {}
    if not numeric.empty:
        desc = numeric.describe().fillna(0).to_dict()
        for col, stats in desc.items():
            numeric_summary[col] = {
                "min": float(stats.get("min", 0)),
                "max": float(stats.get("max", 0)),
                "mean": float(stats.get("mean", 0)),
                "median": float(numeric[col].median()),
                "std": float(stats.get("std", 0)),
                "non_null": int(stats.get("count", 0)),
            }

    categorical_summary = {}
    obj = df.select_dtypes(include=["object", "category"])
    for col in obj.columns:
        vc = obj[col].astype(str).value_counts().head(5)
        categorical_summary[col] = [
            {"value": k, "count": int(v)} for k, v in vc.items()
        ]

    null_counts = {c: int(n) for c, n in df.isna().sum().to_dict().items() if n > 0}

    return {
        "rows": int(rows),
        "cols": int(cols),
        "columns": list(df.columns),
        "dtypes": dtypes,
        "numeric": numeric_summary,
        "categorical": categorical_summary,
        "null_counts": null_counts,
    }


def run(state):
    files = state.get("workspace", {}).get("files", [])
    csv_files = [
        f for f in files
        if (f.get("ext") or "").lower() in {"csv", "tsv"} and f.get("text")
    ]

    if not csv_files:
        return {
            "tool": "csv_analyzer",
            "ok": True,
            "analyzed": 0,
            "note": "No CSV/TSV files in workspace.",
            "files": [],
        }

    results = []
    for f in csv_files:
        sep = "\t" if (f.get("ext") or "").lower() == "tsv" else ","
        text = f.get("text") or ""
        entry = {"name": f.get("name"), "ok": False}
        try:
            df = pd.read_csv(io.StringIO(text), sep=sep)
            entry.update({"ok": True, **_summarize_frame(df)})
        except Exception as exc:  # parse / encoding errors
            entry["error"] = f"{type(exc).__name__}: {exc}"
        results.append(entry)

    return {
        "tool": "csv_analyzer",
        "ok": True,
        "analyzed": len(results),
        "files": _json.loads(_json.dumps(results, default=str)),
    }

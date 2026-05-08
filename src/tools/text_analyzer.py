"""text_analyzer — real text statistics on text-like files in the workspace."""

import re
from collections import Counter

_STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "if", "to", "of", "in", "on", "at",
    "for", "with", "by", "from", "as", "is", "are", "was", "were", "be", "been",
    "being", "this", "that", "these", "those", "it", "its", "i", "you", "he",
    "she", "we", "they", "them", "their", "his", "her", "our", "your", "my",
    "me", "us", "him", "do", "does", "did", "have", "has", "had", "will",
    "would", "can", "could", "should", "may", "might", "not", "no", "so", "than",
    "then", "there", "here", "what", "which", "who", "when", "where", "why",
    "how", "all", "any", "some", "more", "most", "much", "many", "few", "such",
    "also", "into", "out", "about", "over", "under", "after", "before",
}


def _word_iter(text):
    return (w.lower() for w in re.findall(r"[A-Za-z][A-Za-z'\-]{1,}", text))


def _sentence_count(text):
    return len(re.findall(r"[.!?]+\s|[.!?]+$", text))


def _readability_minutes(words):
    return round(words / 230.0, 1) if words else 0.0


def run(state):
    files = state.get("workspace", {}).get("files", [])
    text_files = [
        f for f in files
        if f.get("text") is not None
        and (f.get("ext") or "").lower() in {"txt", "md", "rst", "log", "html", "htm"}
    ]

    if not text_files:
        return {
            "tool": "text_analyzer",
            "ok": True,
            "analyzed": 0,
            "note": "No text/markdown/log/html files in workspace.",
            "files": [],
            "totals": {"words": 0, "sentences": 0, "chars": 0},
            "top_keywords": [],
        }

    per_file = []
    global_freq = Counter()
    total_words = 0
    total_sentences = 0
    total_chars = 0

    for f in text_files:
        text = f.get("text") or ""
        words = list(_word_iter(text))
        non_stop = [w for w in words if w not in _STOPWORDS and len(w) > 2]
        freq = Counter(non_stop)
        global_freq.update(freq)

        total_words += len(words)
        total_sentences += _sentence_count(text)
        total_chars += len(text)

        per_file.append({
            "name": f.get("name"),
            "size_bytes": f.get("size_bytes", 0),
            "chars": len(text),
            "words": len(words),
            "unique_words": len(set(words)),
            "sentences": _sentence_count(text),
            "reading_minutes": _readability_minutes(len(words)),
            "top_keywords": [{"word": w, "count": c} for w, c in freq.most_common(5)],
        })

    return {
        "tool": "text_analyzer",
        "ok": True,
        "analyzed": len(per_file),
        "files": per_file,
        "totals": {
            "words": total_words,
            "sentences": total_sentences,
            "chars": total_chars,
            "reading_minutes": _readability_minutes(total_words),
        },
        "top_keywords": [
            {"word": w, "count": c} for w, c in global_freq.most_common(10)
        ],
    }

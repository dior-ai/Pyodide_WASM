// Real file workspace: holds File objects the user dropped or picked, with
// metadata + lazy-read content. Tools receive a serializable snapshot of this
// (plus pre-read content for files small enough to inspect) when they execute.

export interface WorkspaceFile {
  id: string;
  name: string;
  size_bytes: number;
  mime: string;
  ext: string;
  last_modified: number;
  /** Inline UTF-8 text, populated when the file is text-like and small enough. */
  text: string | null;
  /** Whether `text` was truncated (file exceeded MAX_TEXT_BYTES). */
  text_truncated: boolean;
}

const TEXT_MIME_PREFIXES = ["text/", "application/json", "application/xml"];
const TEXT_EXTS = new Set([
  "txt", "md", "csv", "tsv", "json", "yaml", "yml", "xml", "html", "htm",
  "py", "js", "ts", "tsx", "jsx", "css", "log", "ini", "toml", "rst",
]);
const MAX_TEXT_BYTES = 1024 * 1024; // 1 MB inline cap to keep state small

function isTextual(file: File, ext: string): boolean {
  if (file.type && TEXT_MIME_PREFIXES.some((p) => file.type.startsWith(p))) {
    return true;
  }
  return TEXT_EXTS.has(ext);
}

function getExt(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
}

export async function ingestFile(file: File): Promise<WorkspaceFile> {
  const ext = getExt(file.name);
  const textual = isTextual(file, ext);

  let text: string | null = null;
  let text_truncated = false;

  if (textual) {
    if (file.size <= MAX_TEXT_BYTES) {
      text = await file.text();
    } else {
      const slice = file.slice(0, MAX_TEXT_BYTES);
      text = await slice.text();
      text_truncated = true;
    }
  }

  return {
    id: cryptoRandomId(),
    name: file.name,
    size_bytes: file.size,
    mime: file.type || guessMime(ext),
    ext,
    last_modified: file.lastModified,
    text,
    text_truncated,
  };
}

function cryptoRandomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function guessMime(ext: string): string {
  const m: Record<string, string> = {
    txt: "text/plain", md: "text/markdown", csv: "text/csv",
    tsv: "text/tab-separated-values", json: "application/json",
    yaml: "text/yaml", yml: "text/yaml", xml: "application/xml",
    html: "text/html", py: "text/x-python", js: "application/javascript",
    ts: "application/typescript", css: "text/css", log: "text/plain",
  };
  return m[ext] ?? "application/octet-stream";
}

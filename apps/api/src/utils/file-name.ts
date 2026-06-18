const MOJIBAKE_MARKERS = /[\u00C0-\u00FF]/;

export function normalizeUploadedFileName(fileName: string) {
  const decoded = Buffer.from(fileName, "latin1").toString("utf8");

  if (decoded.includes("\uFFFD")) {
    return fileName;
  }

  if (MOJIBAKE_MARKERS.test(fileName) || decoded !== fileName) {
    return decoded;
  }

  return fileName;
}

export function titleFromFileName(fileName: string) {
  return normalizeUploadedFileName(fileName).replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || "Untitled book";
}

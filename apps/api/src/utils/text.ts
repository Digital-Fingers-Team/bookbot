export function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function isArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

export function normalizeText(value: string) {
  const cleaned = cleanWhitespace(value);
  
  if (isArabicText(cleaned)) {
    return normalizeArabicText(cleaned);
  }
  
  return cleaned
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeArabicText(value: string): string {
  return cleanWhitespace(value)
    .normalize("NFKD")
    .replace(/[\u064b-\u0652]/g, "")
    .replace(/[\u0640]/g, "");
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function excerpt(value: string, maxLength = 420) {
  const text = cleanWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3).trim()}...`;
}

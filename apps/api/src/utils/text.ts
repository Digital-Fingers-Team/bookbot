export function cleanWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeText(value: string) {
  return cleanWhitespace(value)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function excerpt(value: string, maxLength = 420) {
  const text = cleanWhitespace(value);
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 1).trim()}…`;
}

export function parseAnswerOnlyJson(content: string) {
  const jsonText = extractJsonObject(content);
  const parsed = JSON.parse(jsonText) as { answer?: unknown };

  if (typeof parsed.answer !== "string" || !parsed.answer.trim()) {
    throw new Error("Missing answer");
  }

  return parsed.answer.trim();
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return trimmed;
}

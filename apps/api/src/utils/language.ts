export type AnswerLanguage = "ar" | "en";

// Letters only, in each script. The lookahead is what makes this a letter
// test: the Arabic block also holds punctuation (؟ ، ؛), Arabic-Indic digits
// and diacritics, and counting those as letters made a question like "123 ؟!"
// look Arabic. Matching by script rather than by range keeps the Supplement,
// Extended-A and the presentation forms found in text extracted from PDFs.
const ARABIC_PATTERN = /(?=\p{L})\p{Script=Arabic}/gu;
const LATIN_PATTERN = /(?=\p{L})\p{Script=Latin}/gu;

function scriptOf(word: string): AnswerLanguage | null {
  const arabic = word.match(ARABIC_PATTERN)?.length ?? 0;
  const latin = word.match(LATIN_PATTERN)?.length ?? 0;
  if (arabic === 0 && latin === 0) return null;
  return arabic >= latin ? "ar" : "en";
}

/**
 * Which language a reply should be written in, based on the user's question.
 *
 * Returns null when the question carries no letters to judge by (digits,
 * punctuation or emoji only) so callers can leave the choice to the model
 * rather than forcing a language on the basis of nothing.
 *
 * A question mixing scripts is answered in whichever one dominates, so an
 * Arabic question containing an English product or technical term still gets
 * an Arabic answer.
 */
export function detectAnswerLanguage(question: string): AnswerLanguage | null {
  // Counted per word, not per character. Arabic writes far fewer characters
  // for the same meaning, so a character count let a single quoted English
  // term ("ما هي knowledge management؟") outweigh the Arabic question around
  // it and flip the answer to English.
  let arabicWords = 0;
  let latinWords = 0;

  for (const word of question.split(/\s+/)) {
    const script = scriptOf(word);
    if (script === "ar") arabicWords += 1;
    else if (script === "en") latinWords += 1;
  }

  if (arabicWords === 0 && latinWords === 0) return null;

  // A tie goes to Arabic: this is an Arabic-first library, and someone writing
  // in Arabic wants an Arabic answer even when they quote English jargon.
  return arabicWords >= latinWords ? "ar" : "en";
}

const LANGUAGE_NAMES: Record<AnswerLanguage, string> = {
  ar: "Arabic",
  en: "English"
};

/**
 * A hard instruction naming the target language.
 *
 * The prompt already asks the model to detect the language itself, but that is
 * unreliable in practice: the system prompt is written in English, so refusals
 * and "not found" explanations tended to come back in English even for Arabic
 * questions — the reply mirrored the prompt's own wording. Naming the language
 * explicitly, and repeating it as the last thing the model reads, removes the
 * ambiguity.
 */
export function buildLanguageDirective(language: AnswerLanguage | null): string {
  if (!language) return "";
  const name = LANGUAGE_NAMES[language];
  return `Write your entire reply in ${name}, because the user's question is in ${name}. This applies to every part of the reply, including any explanation that the books do not cover the question. Do not answer in any other language.`;
}

const NOT_FOUND_MESSAGES: Record<AnswerLanguage, string> = {
  ar: "لم أجد هذه المعلومة في الكتب.",
  en: "I couldn't find this information in the books."
};

/** The "nothing retrieved" reply, in the language the user asked in. */
export function notFoundMessage(question: string): string {
  return NOT_FOUND_MESSAGES[detectAnswerLanguage(question) ?? "en"];
}

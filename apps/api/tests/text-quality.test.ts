import { describe, expect, it } from "vitest";
import { evaluateTextQuality } from "../src/services/ingestion/text-quality.service.js";

// Strings captured from the real "دور القيادة" PDF during diagnosis.
const CLEAN_OCR =
  "الفصل الأول: المهارات القيادية الفعالة المبحث الأول ماهية القيادة وأهميتها الإدارية تعرف المؤسسات " +
  "اهتمامًا متزايدًا بالعنصر البشري في الوقت الراهن لما له من دور في شؤون المؤسسات سواء في نجاحها وفعاليتها";

const KASHIDA_CORRUPT =
  "تعتمد على اسكككككككككككككتخدام الأسككككككككككككككاليب والأدوات والمناهج العلمية التي من " +
  "شككككككككككككككأنها تعظيم فاعلية القيادة ومن هذه الأدوات";

const SCATTERED_CORRUPT =
  "ا م ا م ت ه ا د ي ا ز ت م ن ه ا ر ل ا ت ق و ل ا ي ر ش ب ل ا ر ص ن ع ل ا ب ا ه ت ا س س ؤ لم ا ن و ؤ ش ر و د ن م ل ل ا";

describe("evaluateTextQuality", () => {
  it("scores clean Arabic as trustworthy", () => {
    expect(evaluateTextQuality(CLEAN_OCR).score).toBeGreaterThanOrEqual(70);
  });

  it("flags kashida/repeated-letter corruption for OCR", () => {
    const result = evaluateTextQuality(KASHIDA_CORRUPT);
    expect(result.score).toBeLessThan(65);
    expect(result.reasons).toContain("repeated-letters");
  });

  it("flags reversed letter-spaced corruption for OCR", () => {
    const result = evaluateTextQuality(SCATTERED_CORRUPT);
    expect(result.score).toBeLessThan(65);
    expect(result.reasons).toContain("scattered-letters");
  });

  it("treats empty pages as the worst score", () => {
    expect(evaluateTextQuality("   ").score).toBe(0);
  });
});

import { describe, expect, it } from "vitest";
import { readableBookTitle, titleFromFileName } from "../src/utils/file-name.js";

describe("file name utilities", () => {
  it("keeps readable Arabic titles", () => {
    expect(titleFromFileName("نظريات القيادة.pdf")).toBe("نظريات القيادة");
  });

  it("falls back to first-page Arabic text for corrupted filename titles", () => {
    const title = readableBookTitle({
      title: "F81J'* 'DBJ'/) EF 'D*BDJ/) %DI 'D1BEJ)",
      originalFileName: "F81J'* 'DBJ'/) EF 'D*BDJ/) %DI 'D1BEJ).pdf",
      firstPageText: "المنظمة العربية للتنمية الإدارية جامعة الدول العربية نظريات القيادة من التقليدية إلى الرقمية."
    });

    expect(title).toContain("المنظمة العربية للتنمية الإدارية");
  });
});

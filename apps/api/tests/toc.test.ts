import { describe, expect, it } from "vitest";
import { isLikelyTableOfContents } from "../src/utils/text.js";

describe("isLikelyTableOfContents", () => {
  it("flags an Arabic contents page with dotted leaders, section markers and page numbers", () => {
    const toc =
      "......الفعالة .............. سا سس 45 المبحث الأول: ماهية القيادة وأهميتها 47 " +
      "أولاً: الفرق بين الإدارة والقيادة؛ 54 رابعاً: القيادة علم وفن؛ 85 خامساً: القيادة الفعالة؛ ......تت 56";
    expect(isLikelyTableOfContents(toc)).toBe(true);
  });

  it("flags a page that explicitly says فهرس / المحتويات", () => {
    expect(isLikelyTableOfContents("فهرس المحتويات\nالمقدمة\nالفصل الأول")).toBe(true);
  });

  it("does not flag ordinary prose", () => {
    const prose =
      "مفهوم القيادة: تعددت الآراء وتباينت حول مفاهيم القيادة والقائد. واختلف الباحثون في تحديد هذه المفاهيم، " +
      "إذ يرى بعضهم أن القيادة عملية تأثير في الآخرين لتحقيق أهداف مشتركة.";
    expect(isLikelyTableOfContents(prose)).toBe(false);
  });

  it("does not flag number-heavy prose (statistics)", () => {
    const stats =
      "بلغت نسبة المشاركين 45 بالمئة في عام 2020 وارتفعت إلى 60 بالمئة، وهو ما يعكس تطورًا ملحوظًا في الأداء المؤسسي.";
    expect(isLikelyTableOfContents(stats)).toBe(false);
  });
});

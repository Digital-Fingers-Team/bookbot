import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseBooksExcel } from "../src/services/import/excel-book-import.service.js";

describe("Excel book import", () => {
  it("reads titles with xml:space attributes as text", async () => {
    const workbook = await readFile(new URL("../../../books.xlsx", import.meta.url));
    const rows = await parseBooksExcel(workbook);

    expect(rows.find((row) => row.rowNumber === 62)?.title).toBe("علم الإدارة العامة: قديماً وحديثاً");
    expect(rows.find((row) => row.rowNumber === 63)?.title).toBe("تحسين جودة الخدمات الصحية  في المستشفيات العربية : بـحوث مُحكمة منتقاة");
    expect(rows.some((row) => row.title.includes("[object Object]"))).toBe(false);
  });
});

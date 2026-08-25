import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseBooksExcel } from "../src/services/import/excel-book-import.service.js";

describe("Excel book import", () => {
  it("reads titles with xml:space attributes as text", async () => {
    const workbook = await readFile(new URL("../../../books.xlsx", import.meta.url));
    const rows = await parseBooksExcel(workbook);

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => typeof row.title === "string" && row.title.length > 0)).toBe(true);
    expect(rows.every((row) => Object.values(row).every((value) => value === null || typeof value !== "object"))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("[object Object]");
    expect(rows.every((row) => Number.isInteger(row.rowNumber) && row.rowNumber > 0)).toBe(true);
    expect(new Set(rows.map((row) => row.rowNumber)).size).toBe(rows.length);
  });
});

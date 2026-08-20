import fs from "node:fs/promises";
import JSZip from "../apps/api/node_modules/jszip/lib/index.js";

const source = "books.xlsx";
const target = "books-test-10.xlsx";
const input = await fs.readFile(source);
const zip = await JSZip.loadAsync(input);
const sheetPath = "xl/worksheets/sheet1.xml";
const sheet = await zip.file(sheetPath).async("string");
const dataStart = sheet.indexOf("<sheetData");
const dataOpenEnd = sheet.indexOf(">", dataStart) + 1;
const dataEnd = sheet.indexOf("</sheetData>", dataOpenEnd);
const rows = sheet.slice(dataOpenEnd, dataEnd).match(/<row\b[\s\S]*?<\/row>/g)?.slice(0, 10) ?? [];
if (rows.length !== 10) throw new Error(`Expected 10 rows, found ${rows.length}`);
const replacement = sheet.slice(dataStart, dataOpenEnd) + rows.join("") + "</sheetData>";
const output = sheet.slice(0, dataStart) + replacement + sheet.slice(dataEnd + "</sheetData>".length);
zip.file(sheetPath, output);
await fs.writeFile(target, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
console.log(`Created ${target} with ${rows.length} book rows.`);

import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { htmlToText } from "html-to-text";

import { BaseOpenedDocument, BasePageExtractor } from "./base.extractor.js";

import { cleanExtractedText } from "../../../utils/text.js";
import { assertSafeZipSize } from "./zip-guard.js";

import type { ExtractedPage, OpenedDocument } from "./extractor.js";

const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

class EpubDocument extends BaseOpenedDocument {
  constructor(private readonly chapters: string[]) {
    super();
  }

  get pageCount(): number {
    return this.chapters.length;
  }

  async extractPage(pageNumber: number): Promise<ExtractedPage> {
    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new RangeError(`Page ${pageNumber} does not exist.`);
    }

    return {
      pageNumber,
      text: cleanExtractedText(this.chapters[pageNumber - 1] ?? "")
    };
  }
}

export class EpubExtractor extends BasePageExtractor {
  readonly name = "epub";

  async open(buffer: Buffer): Promise<OpenedDocument> {
    const zip = await JSZip.loadAsync(buffer);
    assertSafeZipSize(zip);

    const containerXml = await readZipText(zip, "META-INF/container.xml");
    const container = xmlParser.parse(containerXml);
    const opfPath: string | undefined = container?.container?.rootfiles?.rootfile?.["@_full-path"];

    if (!opfPath) {
      throw new Error("This EPUB is missing its content manifest (container.xml).");
    }

    const opfDir = opfPath.includes("/") ? opfPath.slice(0, opfPath.lastIndexOf("/") + 1) : "";
    const opfXml = await readZipText(zip, opfPath);
    const opf = xmlParser.parse(opfXml);

    const manifestItems = toArray(opf?.package?.manifest?.item);
    const spineItems = toArray(opf?.package?.spine?.itemref);
    const manifestById = new Map(manifestItems.map((item) => [item["@_id"], item]));

    const chapters: string[] = [];

    for (const spineItem of spineItems) {
      const manifestEntry = manifestById.get(spineItem["@_idref"]);
      const href = manifestEntry?.["@_href"];
      if (!href) {
        continue;
      }

      const path = `${opfDir}${decodeURIComponent(href)}`;
      const html = await readZipText(zip, path).catch(() => "");
      if (!html) {
        continue;
      }

      const text = htmlToText(html, { wordwrap: false }).trim();
      if (text) {
        chapters.push(text);
      }
    }

    if (!chapters.length) {
      throw new Error("No readable chapters were found in this EPUB.");
    }

    return new EpubDocument(chapters);
  }
}

function toArray<T>(value: T | T[] | undefined): T[] {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value : [value];
}

async function readZipText(zip: JSZip, path: string): Promise<string> {
  const normalized = path.replace(/^\//, "");
  const file = zip.file(normalized) ?? zip.file(path);
  if (!file) {
    throw new Error(`EPUB entry not found: ${path}`);
  }
  return file.async("text");
}

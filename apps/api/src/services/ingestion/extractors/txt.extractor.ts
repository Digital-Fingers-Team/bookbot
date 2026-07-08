import { BaseOpenedDocument, BasePageExtractor } from "./base.extractor.js";

import { cleanExtractedText } from "../../../utils/text.js";
import { paginate } from "./paginate.js";

import type { ExtractedPage, OpenedDocument } from "./extractor.js";

class TxtDocument extends BaseOpenedDocument {
  constructor(private readonly pages: string[]) {
    super();
  }

  get pageCount(): number {
    return this.pages.length;
  }

  async extractPage(pageNumber: number): Promise<ExtractedPage> {
    if (pageNumber < 1 || pageNumber > this.pageCount) {
      throw new RangeError(`Page ${pageNumber} does not exist.`);
    }

    return {
      pageNumber,
      text: cleanExtractedText(this.pages[pageNumber - 1] ?? "")
    };
  }
}

export class TxtExtractor extends BasePageExtractor {
  readonly name = "txt";

  async open(buffer: Buffer): Promise<OpenedDocument> {
    const text = decodeText(buffer);
    const pages = paginate(text);

    if (!pages.length) {
      throw new Error("This text file does not contain readable text.");
    }

    return new TxtDocument(pages);
  }
}

/**
 * Decodes a plain-text upload, respecting a BOM when present and otherwise
 * requiring strict UTF-8. Falling back to a lossy decode for non-UTF-8 bytes
 * would silently turn legacy-encoded files (e.g. Windows-1256 Arabic) into
 * mojibake, so we fail loudly instead and ask for a UTF-8 re-save.
 */
function decodeText(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer.subarray(3));
  }

  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return new TextDecoder("utf-16le", { fatal: true }).decode(buffer.subarray(2));
  }

  if (buffer.length >= 2 && buffer[0] === 0xfe && buffer[1] === 0xff) {
    return new TextDecoder("utf-16be", { fatal: true }).decode(buffer.subarray(2));
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new Error(
      "This text file isn't valid UTF-8. Please re-save it with UTF-8 encoding and upload again."
    );
  }
}

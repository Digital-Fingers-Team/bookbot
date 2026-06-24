import type {
  ExtractedPage,
  OpenedDocument,
  PageExtractor,
} from "./extractor.js";

export abstract class BaseOpenedDocument
  implements OpenedDocument
{
  abstract readonly pageCount: number;

  abstract extractPage(
    pageNumber: number
  ): Promise<ExtractedPage>;

  async close(): Promise<void> {
    // Default implementation.
  }
}

export abstract class BasePageExtractor
  implements PageExtractor
{
  abstract readonly name: string;

  abstract open(
    buffer: Buffer
  ): Promise<OpenedDocument>;
}
export type RenderedPage = {
  pageNumber: number;

  image: Buffer;

  mimeType: "image/png";
};

export interface OpenedRenderer {

  readonly pageCount: number;

  renderPage(
    pageNumber: number,
    dpi?: number
  ): Promise<RenderedPage>;

  close?(): Promise<void>;
}

export interface PageRenderer {

  readonly name: string;

  open(
    buffer: Buffer
  ): Promise<OpenedRenderer>;

}
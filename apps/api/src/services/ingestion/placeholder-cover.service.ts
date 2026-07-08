import { createCanvas } from "@napi-rs/canvas";

import type { SourceFormat } from "../../utils/source-format.js";

const WIDTH = 400;
const HEIGHT = 560;

const FORMAT_COLORS: Record<SourceFormat, string> = {
  pdf: "#5b6b4f",
  epub: "#3f6b6f",
  docx: "#3f5b8f",
  txt: "#6b5b3f"
};

/**
 * Generates a simple, book-cover-shaped placeholder image for source formats
 * that have no page to rasterize (EPUB/DOCX/TXT), so the public showcase
 * carousel and library cards always have something to render.
 */
export async function renderPlaceholderCover(title: string, format: SourceFormat): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = FORMAT_COLORS[format] ?? FORMAT_COLORS.pdf;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(0, HEIGHT - 90, WIDTH, 90);

  const initial = (title.trim()[0] ?? "?").toUpperCase();
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 180px sans-serif";
  ctx.fillText(initial, WIDTH / 2, HEIGHT / 2 - 30);

  ctx.font = "bold 28px sans-serif";
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(format.toUpperCase(), WIDTH / 2, HEIGHT - 45);

  return canvas.encode("png");
}

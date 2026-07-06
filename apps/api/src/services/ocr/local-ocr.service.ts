import os from "node:os";

import { createScheduler, createWorker, PSM, type Bbox, type Block, type RecognizeResult, type Scheduler } from "tesseract.js";

import { env } from "../../config/env.js";

// Downloaded language models are cached here so they are fetched only once.
const CACHE_PATH = ".tesseract-cache";
const LSTM_ONLY = 1;

let schedulerPromise: Promise<Scheduler> | undefined;

async function getScheduler(): Promise<Scheduler> {
  if (!schedulerPromise) {
    schedulerPromise = createPool().catch((error) => {
      // Allow a later retry if the model download/initialisation failed.
      schedulerPromise = undefined;
      throw error;
    });
  }

  return schedulerPromise;
}

async function createPool(): Promise<Scheduler> {
  const langs = env.OCR_LOCAL_LANGS.split("+")
    .map((lang) => lang.trim())
    .filter(Boolean);

  const workerCount = Math.max(1, Math.min(env.OCR_CONCURRENCY, os.cpus().length || 1));
  const scheduler = createScheduler();

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      const worker = await createWorker(langs, LSTM_ONLY, { cachePath: CACHE_PATH });

      // SPARSE_TEXT finds each word/line as an independent region instead of
      // forcing everything on the page into one reading order. AUTO (the
      // default) tries to merge diagram labels, arrows and captions into fake
      // paragraph lines, which is what produced the garbled/random-looking text.
      await worker.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
      scheduler.addWorker(worker);
    })
  );

  console.log(`[ocr] local tesseract ready (${workerCount} worker(s), langs=${env.OCR_LOCAL_LANGS})`);
  return scheduler;
}

/**
 * Offline OCR using tesseract.js. Used as the free fallback when the OpenRouter
 * vision model is unavailable (no key / out of credits) or when OCR_PROVIDER is
 * set to `local`. Quality is lower than the cloud model but far better than a
 * broken text layer.
 */
export async function localOcr(image: Buffer): Promise<string> {
  const scheduler = await getScheduler();
  const result = (await scheduler.addJob(
    "recognize",
    image,
    {},
    { text: false, blocks: true }
  )) as RecognizeResult;

  return blocksToText(result.data.blocks ?? []);
}

// Reconstructs text word-by-word instead of using tesseract's own line-level
// `text` output, so a single low-confidence guess (typical for icons/shapes in
// figures) drops only that word rather than polluting the whole line.
//
// SPARSE_TEXT finds each line as an independent region and gives no overall
// reading order, so `blocks` arrives in whatever order tesseract detected the
// regions in - not top-to-bottom. That's what turned tables into scrambled
// word soup. Rebuild reading order from each line's bbox instead: cluster
// lines that share a vertical band into rows, then order rows top-to-bottom
// and lines within a row left-to-right.
function blocksToText(blocks: Block[]): string {
  const lines: Array<{ bbox: Bbox; text: string }> = [];

  for (const block of blocks) {
    for (const paragraph of block.paragraphs) {
      for (const line of paragraph.lines) {
        const words = line.words
          .filter((word) => word.confidence >= env.OCR_LOCAL_MIN_WORD_CONFIDENCE && word.text.trim().length > 0)
          .sort((a, b) => a.bbox.x0 - b.bbox.x0)
          .map((word) => word.text.trim());

        if (words.length > 0) {
          lines.push({ bbox: line.bbox, text: words.join(" ") });
        }
      }
    }
  }

  return groupIntoRows(lines)
    .map((row) => row.sort((a, b) => a.bbox.x0 - b.bbox.x0).map((line) => line.text).join(" "))
    .join("\n")
    .trim();
}

function groupIntoRows(
  lines: Array<{ bbox: Bbox; text: string }>
): Array<Array<{ bbox: Bbox; text: string }>> {
  const sorted = [...lines].sort((a, b) => a.bbox.y0 - b.bbox.y0);
  const rows: Array<{ items: Array<{ bbox: Bbox; text: string }>; bottom: number }> = [];

  for (const line of sorted) {
    const height = line.bbox.y1 - line.bbox.y0;
    const currentRow = rows.at(-1);

    // A line joins the current row when its top overlaps the row's vertical
    // band; otherwise it starts a new row below.
    if (currentRow && line.bbox.y0 < currentRow.bottom - height * 0.3) {
      currentRow.items.push(line);
      currentRow.bottom = Math.max(currentRow.bottom, line.bbox.y1);
    } else {
      rows.push({ items: [line], bottom: line.bbox.y1 });
    }
  }

  return rows.map((row) => row.items);
}

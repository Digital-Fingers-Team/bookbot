import os from "node:os";

import { createScheduler, createWorker, type RecognizeResult, type Scheduler } from "tesseract.js";

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
  const result = (await scheduler.addJob("recognize", image)) as RecognizeResult;

  return (result.data.text ?? "").trim();
}

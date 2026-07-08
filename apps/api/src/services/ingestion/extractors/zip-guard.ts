import type JSZip from "jszip";

import { env } from "../../../config/env.js";

/**
 * Zip-bomb guard: JSZip's central-directory parse (`loadAsync`) already knows
 * each entry's decompressed size without inflating it, so we can reject an
 * oversized archive before any entry is actually decompressed.
 */
export function assertSafeZipSize(zip: JSZip): void {
  const maxBytes = env.INGESTION_MAX_DECOMPRESSED_MB * 1024 * 1024;
  let totalUncompressedSize = 0;

  for (const file of Object.values(zip.files)) {
    const size = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize ?? 0;
    totalUncompressedSize += size;
    if (totalUncompressedSize > maxBytes) {
      throw new Error(
        `This file's decompressed contents exceed the ${env.INGESTION_MAX_DECOMPRESSED_MB}MB limit.`
      );
    }
  }
}

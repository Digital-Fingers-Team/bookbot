import { mkdir, readFile, rm, writeFile, access } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import { Readable } from "node:stream";
import mongoose from "mongoose";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand
} from "@aws-sdk/client-s3";
import { env } from "../../config/env.js";

/**
 * Blob storage for uploaded PDFs and payment receipts. Keys are forward-slash
 * paths like "pdfs/<file>.pdf" or "receipts/<uuid>.png". The local driver maps
 * keys under STORAGE_LOCAL_DIR; the s3 driver stores them in a bucket (S3/R2),
 * which is what keeps blobs alive across redeploys on ephemeral-disk platforms.
 */
export interface StorageProvider {
  readonly name: "local" | "gridfs" | "s3";
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}

class LocalStorageProvider implements StorageProvider {
  readonly name = "local" as const;
  private readonly baseDir = resolve(env.STORAGE_LOCAL_DIR);

  // Tolerate legacy absolute paths stored before the abstraction existed.
  private resolveKey(key: string) {
    return isAbsolute(key) ? key : resolve(this.baseDir, key);
  }

  async put(key: string, body: Buffer) {
    const path = this.resolveKey(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  async get(key: string) {
    return readFile(this.resolveKey(key));
  }

  async delete(key: string) {
    await rm(this.resolveKey(key), { force: true }).catch(() => undefined);
  }

  async exists(key: string) {
    try {
      await access(this.resolveKey(key));
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Stores blobs inside MongoDB via GridFS — keeps everything in one datastore and
 * survives redeploys on ephemeral-disk platforms, with no external account.
 * The `filename` is the storage key; we keep a single version per key.
 */
class GridFsStorageProvider implements StorageProvider {
  readonly name = "gridfs" as const;

  private bucket() {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error("GridFS storage requires an active MongoDB connection.");
    }
    return new mongoose.mongo.GridFSBucket(db, { bucketName: "uploads" });
  }

  async put(key: string, body: Buffer, contentType: string) {
    // Replace any existing object with the same key (keep one version).
    await this.delete(key);
    const bucket = this.bucket();
    await new Promise<void>((resolvePut, reject) => {
      const stream = bucket.openUploadStream(key, { contentType });
      stream.on("error", reject);
      stream.on("finish", () => resolvePut());
      Readable.from(body).pipe(stream);
    });
  }

  async get(key: string) {
    const bucket = this.bucket();
    const chunks: Buffer[] = [];
    await new Promise<void>((resolveGet, reject) => {
      const stream = bucket.openDownloadStreamByName(key);
      stream.on("data", (chunk: Buffer) => chunks.push(chunk));
      stream.on("error", reject);
      stream.on("end", () => resolveGet());
    });
    return Buffer.concat(chunks);
  }

  async delete(key: string) {
    const bucket = this.bucket();
    const files = await bucket.find({ filename: key }).toArray();
    await Promise.all(files.map((file) => bucket.delete(file._id).catch(() => undefined as void)));
  }

  async exists(key: string) {
    const bucket = this.bucket();
    const found = await bucket.find({ filename: key }).limit(1).toArray();
    return found.length > 0;
  }
}

class S3StorageProvider implements StorageProvider {
  readonly name = "s3" as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor() {
    if (!env.S3_BUCKET) {
      throw new Error("STORAGE_DRIVER=s3 requires S3_BUCKET to be set.");
    }
    this.bucket = env.S3_BUCKET;
    this.client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
          : undefined
    });
  }

  async put(key: string, body: Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })
    );
  }

  async get(key: string) {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`Empty object for key ${key}`);
    }
    return Buffer.from(bytes);
  }

  async delete(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key })).catch(() => undefined);
  }

  async exists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}

/** Construct a specific storage driver (used by the active singleton + migration). */
export function makeStorage(driver: "local" | "gridfs" | "s3"): StorageProvider {
  switch (driver) {
    case "s3":
      return new S3StorageProvider();
    case "gridfs":
      return new GridFsStorageProvider();
    default:
      return new LocalStorageProvider();
  }
}

export const storage: StorageProvider = makeStorage(env.STORAGE_DRIVER);

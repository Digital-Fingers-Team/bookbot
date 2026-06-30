import type { NextFunction, Request, Response } from "express";
import type { ZodTypeAny, infer as ZodInfer } from "zod";
import { ApiError } from "../utils/api-error.js";

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

/**
 * Validate request body/query/params against zod schemas. On success the parsed
 * (and coerced) values replace the originals; on failure a 400 ApiError with the
 * flattened issues is thrown. Centralises what was ad-hoc `typeof` checking.
 */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction) => {
    for (const key of ["body", "query", "params"] as const) {
      const schema = schemas[key];
      if (!schema) {
        continue;
      }
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        throw new ApiError(400, "VALIDATION_ERROR", "Some fields are invalid.", result.error.flatten());
      }
      // query/params are read-only getters on newer express; assign defensively.
      try {
        (req as unknown as Record<string, unknown>)[key] = result.data;
      } catch {
        Object.assign(req[key] as object, result.data as object);
      }
    }
    next();
  };
}

export type Infer<T extends ZodTypeAny> = ZodInfer<T>;

import type { PublicUser } from "../services/auth/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export {};

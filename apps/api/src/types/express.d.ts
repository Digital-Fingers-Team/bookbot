import type { PublicUser } from "../services/auth/auth.service.js";
import type { NetworkBookAccess } from "../services/access/network-policy.service.js";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      networkBookAccess?: NetworkBookAccess;
      networkBookIds?: Set<string>;
    }
  }
}

export {};

import type { Request } from 'express';
import type { SecurityContext } from '../../application/index.js';

export function toSecurityContext(req: Request): SecurityContext {
  return {
    ip: req.ip ?? null,
    userAgent: req.headers['user-agent'] ?? null
  };
}

import { SetMetadata } from '@nestjs/common';

export const AUDIT_KEY = 'audit';

export interface AuditMeta {
  entityType: string;
  action: string;
}

/**
 * Opt-in: tag a mutating handler so AuditLogInterceptor records it.
 * Example: @Audit('user', 'create')
 */
export const Audit = (entityType: string, action: string) => SetMetadata(AUDIT_KEY, { entityType, action } as AuditMeta);

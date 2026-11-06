import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { AUDIT_KEY, AuditMeta } from './audit.decorator';

/**
 * Applied globally (see AppModule). Only acts on handlers explicitly tagged
 * with @Audit(); everything else passes through untouched. Phase 1 only
 * records "after" state - "before" diffing arrives once update endpoints
 * exist to capture a pre-mutation snapshot.
 */
@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMeta | undefined>(AUDIT_KEY, context.getHandler());
    if (!meta) return next.handle();

    const request = context.switchToHttp().getRequest();
    const actorId: string | undefined = request.user?.id;
    const ipAddress: string | undefined = request.ip;

    return next.handle().pipe(
      tap((result) => {
        const entityId = (result as { id?: string } | undefined)?.id ?? request.params?.id ?? null;
        this.prisma.auditLog
          .create({
            data: {
              actorId: actorId ?? null,
              action: `${meta.entityType}.${meta.action}`,
              entityType: meta.entityType,
              entityId,
              after: result ? JSON.parse(JSON.stringify(result)) : undefined,
              ipAddress: ipAddress ?? null,
            },
          })
          // Audit logging must never break the request it's observing.
          .catch((err) => {
            // eslint-disable-next-line no-console
            console.error('AuditLogInterceptor failed to write audit log', err);
          });
      }),
    );
  }
}

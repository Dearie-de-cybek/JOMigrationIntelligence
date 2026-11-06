import { BadRequestException, PipeTransform } from '@nestjs/common';
import type { ZodSchema } from 'zod';

/**
 * Validates a request body/query/params against a Zod schema from
 * @jo/schemas - the same schema the Next.js forms use client-side, so a
 * validation rule is defined exactly once. Use per-route: @UsePipes(new
 * ZodValidationPipe(loginSchema))
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: result.error.flatten().fieldErrors,
      });
    }
    return result.data;
  }
}

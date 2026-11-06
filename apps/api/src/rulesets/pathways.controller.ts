import { Body, ConflictException, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { createPathwaySchema } from '@jo/schemas';
import { PrismaService } from '../prisma/prisma.service';
import { Public } from '../common/public.decorator';
import { Roles } from '../common/roles.decorator';
import { Audit } from '../common/audit.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

@ApiTags('pathways')
@Controller('pathways')
export class PathwaysController {
  constructor(private prisma: PrismaService) {}

  /** Public catalog: lets the applicant wizard offer only configured pathways. */
  @Public()
  @Get()
  list() {
    return this.prisma.migrationPathway.findMany({
      where: { isActive: true },
      orderBy: [{ destination: 'asc' }, { name: 'asc' }],
      select: { id: true, code: true, destination: true, name: true },
    });
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @Audit('migration_pathway', 'create')
  async create(@Body(new ZodValidationPipe(createPathwaySchema)) body: never) {
    try {
      return await this.prisma.migrationPathway.create({ data: body });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ConflictException('A pathway with that code already exists.');
      }
      throw e;
    }
  }
}

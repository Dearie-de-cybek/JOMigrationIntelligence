import { Body, Controller, Get, Post, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createStaffUserSchema } from '@jo/schemas';
import { UsersService } from './users.service';
import { Roles } from '../common/roles.decorator';
import { Audit } from '../common/audit.decorator';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { toPublicUser } from './user.util';

@ApiTags('users')
@Controller('users')
@Roles('SUPER_ADMIN', 'ADMINISTRATOR')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  async list() {
    const users = await this.usersService.list();
    return users.map(toPublicUser);
  }

  @Post()
  @Audit('user', 'create')
  @UsePipes(new ZodValidationPipe(createStaffUserSchema))
  async create(@Body() body: unknown) {
    const { user, temporaryPassword } = await this.usersService.createStaffUser(body as never);
    return { user: toPublicUser(user), temporaryPassword };
  }
}

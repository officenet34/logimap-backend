import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InvitationsService } from './invitations.service';

@Controller('invitations')
@UseGuards(JwtAuthGuard)
export class InvitationsController {
  constructor(private readonly invitations: InvitationsService) {}

  @Get('pending')
  listPending(@CurrentUser() user: JwtPayload) {
    return this.invitations.listPending(user.sub);
  }

  @Post(':code/accept')
  accept(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    return this.invitations.accept(user.sub, code);
  }

  @Post(':code/reject')
  reject(@CurrentUser() user: JwtPayload, @Param('code') code: string) {
    return this.invitations.reject(user.sub, code);
  }
}

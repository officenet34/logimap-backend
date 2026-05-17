import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OrganizationsService } from './organizations.service';
import { InviteDriverDto } from './dto/invite-driver.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly orgs: OrganizationsService) {}

  @Get()
  listMine(@CurrentUser() user: JwtPayload) {
    return this.orgs.listMine(user.sub);
  }

  @Get(':id/drivers/locations')
  driverLocations(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orgs.getDriversOnMap(user.sub, id);
  }

  @Post(':id/invitations/driver')
  inviteDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: InviteDriverDto,
  ) {
    return this.orgs.inviteDriver(user.sub, id, dto);
  }

  @Post(':id/members/self-driver')
  addSelfDriver(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orgs.addSelfAsDriver(user.sub, id);
  }

  @Post(':id/active')
  setActive(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orgs.setActiveOrganization(user.sub, id);
  }
}

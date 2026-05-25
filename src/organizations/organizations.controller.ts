import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { OrganizationsService } from './organizations.service';
import { InviteDriverDto } from './dto/invite-driver.dto';
import { InviteMemberDto } from './dto/invite-member.dto';
import { CreateOrgDriverDto } from './dto/create-org-driver.dto';
import { UpdateOrgDriverDto } from './dto/update-org-driver.dto';

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

  @Get(':id/drivers')
  listDrivers(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.orgs.listDrivers(user.sub, id);
  }

  @Post(':id/drivers')
  createDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateOrgDriverDto,
  ) {
    return this.orgs.createDriver(user.sub, id, dto);
  }

  @Get(':id/drivers/:driverUserId')
  getDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('driverUserId') driverUserId: string,
  ) {
    return this.orgs.getDriver(user.sub, id, driverUserId);
  }

  @Patch(':id/drivers/:driverUserId')
  updateDriver(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('driverUserId') driverUserId: string,
    @Body() dto: UpdateOrgDriverDto,
  ) {
    return this.orgs.updateDriver(user.sub, id, driverUserId, dto);
  }

  @Post(':id/members/invite')
  inviteMember(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.orgs.inviteMember(user.sub, id, dto);
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

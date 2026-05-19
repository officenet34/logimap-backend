import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { UpsertVehicleDto } from './dto/upsert-vehicle.dto';
import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
@UseGuards(JwtAuthGuard)
export class VehiclesController {
  constructor(private readonly vehicles: VehiclesService) {}

  @Get('fleet')
  async listFleet(@CurrentUser() user: JwtPayload) {
    const vehicles = await this.vehicles.listFleet(user.sub);
    return { vehicles };
  }

  @Get('me')
  async getMine(@CurrentUser() user: JwtPayload) {
    const vehicle = await this.vehicles.getMine(user.sub);
    return { vehicle };
  }

  @Put('me')
  async upsertMine(@CurrentUser() user: JwtPayload, @Body() dto: UpsertVehicleDto) {
    const vehicle = await this.vehicles.upsertMine(user.sub, dto);
    return { vehicle };
  }
}

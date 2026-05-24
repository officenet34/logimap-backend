import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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

  @Get('mine')
  async listMine(@CurrentUser() user: JwtPayload) {
    const vehicles = await this.vehicles.listMine(user.sub);
    return { vehicles };
  }

  @Get('me')
  async getMine(@CurrentUser() user: JwtPayload) {
    const vehicle = await this.vehicles.getMine(user.sub);
    return { vehicle };
  }

  @Get('mine/:id')
  async getMineById(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const vehicle = await this.vehicles.getMineById(user.sub, id);
    return { vehicle };
  }

  @Post('mine')
  async createMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertVehicleDto,
  ) {
    const vehicle = await this.vehicles.createMine(user.sub, dto);
    return { vehicle };
  }

  @Put('mine/:id')
  async updateMine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpsertVehicleDto,
  ) {
    const vehicle = await this.vehicles.updateMine(user.sub, id, dto);
    return { vehicle };
  }

  @Delete('mine/:id')
  async deleteMine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this.vehicles.deleteMine(user.sub, id);
  }

  @Put('me')
  async upsertMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpsertVehicleDto,
  ) {
    const vehicle = await this.vehicles.upsertMine(user.sub, dto);
    return { vehicle };
  }
}

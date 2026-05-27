import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateGlobalMapAlertDto } from './dto/create-global-map-alert.dto';
import { UpdateGlobalMapAlertDto } from './dto/update-global-map-alert.dto';
import { MapAlertsService } from './map-alerts.service';

@Controller('map-alerts')
@UseGuards(JwtAuthGuard)
export class MapAlertsController {
  constructor(private readonly alerts: MapAlertsService) {}

  @Get()
  list() {
    return this.alerts.list();
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGlobalMapAlertDto) {
    return this.alerts.create(user.sub, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGlobalMapAlertDto,
  ) {
    return this.alerts.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.alerts.remove(user.sub, id);
  }
}

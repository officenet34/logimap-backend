import { Module } from '@nestjs/common';
import { MapAlertsController } from './map-alerts.controller';
import { MapAlertsService } from './map-alerts.service';

@Module({
  controllers: [MapAlertsController],
  providers: [MapAlertsService],
})
export class MapAlertsModule {}

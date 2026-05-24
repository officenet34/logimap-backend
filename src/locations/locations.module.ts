import { Module } from '@nestjs/common';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';
import { SavedLocationsController } from './saved-locations.controller';
import { SavedLocationsService } from './saved-locations.service';

@Module({
  controllers: [LocationsController, SavedLocationsController],
  providers: [LocationsService, SavedLocationsService],
})
export class LocationsModule {}

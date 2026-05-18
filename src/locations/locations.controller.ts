import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { IngestLocationDto } from './dto/ingest-location.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Post()
  ingest(@CurrentUser() user: JwtPayload, @Body() dto: IngestLocationDto) {
    return this.locations.ingest(user.sub, dto);
  }

  @Get('me')
  getMyLatest(@CurrentUser() user: JwtPayload) {
    return this.locations.getMyLatest(user.sub);
  }
}

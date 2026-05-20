import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EstimateRouteDto } from './dto/estimate-route.dto';
import { RoutesService } from './routes.service';

@Controller('routes')
@UseGuards(JwtAuthGuard)
export class RoutesController {
  constructor(private readonly routes: RoutesService) {}

  /** Nakliye mesafe/süre — önce DB önbellek, yoksa Google Routes API. */
  @Post('estimate')
  estimate(@Body() dto: EstimateRouteDto) {
    return this.routes.estimate(dto);
  }
}

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ResolvePlaceDto } from './dto/resolve-place.dto';
import { PlacesService } from './places.service';

@Controller('places')
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  /** Adres yazarken öneriler — önce DB, eksikse Google Places. */
  @Get('autocomplete')
  autocomplete(@Query('q') q?: string) {
    return this.places.autocomplete(q ?? '');
  }

  /** Seçilen placeId → koordinat (önce DB, yoksa Google → DB kayıt). */
  @Post('resolve')
  resolve(@Body() dto: ResolvePlaceDto) {
    const coords =
      dto.lat != null && dto.lng != null
        ? {
            lat: dto.lat,
            lng: dto.lng,
            displayLabel: dto.displayLabel,
            formattedAddress: dto.formattedAddress,
          }
        : undefined;
    return this.places.resolve(dto.placeId, coords);
  }
}

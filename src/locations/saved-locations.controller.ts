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
import { CreateSavedLocationDto } from './dto/create-saved-location.dto';
import { UpdateSavedLocationDto } from './dto/update-saved-location.dto';
import { SavedLocationsService } from './saved-locations.service';

@Controller('saved-locations')
@UseGuards(JwtAuthGuard)
export class SavedLocationsController {
  constructor(private readonly savedLocations: SavedLocationsService) {}

  @Get('mine')
  listMine(@CurrentUser() user: JwtPayload) {
    return this.savedLocations.listMine(user.sub);
  }

  @Get('mine/count')
  countMine(@CurrentUser() user: JwtPayload) {
    return this.savedLocations.countMine(user.sub);
  }

  @Post('mine')
  createMine(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateSavedLocationDto,
  ) {
    return this.savedLocations.createMine(user.sub, dto);
  }

  @Patch('mine/:id')
  updateMine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateSavedLocationDto,
  ) {
    return this.savedLocations.updateMine(user.sub, id, dto);
  }

  @Delete('mine/:id')
  deleteMine(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.savedLocations.deleteMine(user.sub, id);
  }
}

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateFreightShipmentDto } from './dto/create-freight-shipment.dto';
import { FreightShipmentsService } from './freight-shipments.service';

@Controller('freight-shipments')
@UseGuards(JwtAuthGuard)
export class FreightShipmentsController {
  constructor(private readonly shipments: FreightShipmentsService) {}

  @Post()
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateFreightShipmentDto,
  ) {
    const shipment = await this.shipments.create(user.sub, dto);
    return { shipment };
  }

  @Get('mine')
  async listMine(@CurrentUser() user: JwtPayload) {
    const shipments = await this.shipments.listMine(user.sub);
    return { shipments };
  }

  @Get('mine/:id')
  async getMine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    const shipment = await this.shipments.getMine(user.sub, id);
    if (!shipment) {
      throw new NotFoundException('Nakliye kaydı bulunamadı');
    }
    return { shipment };
  }
}

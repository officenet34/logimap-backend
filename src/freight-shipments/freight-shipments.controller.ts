import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
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

  @Put('mine/:id')
  async updateMine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: CreateFreightShipmentDto,
  ) {
    const shipment = await this.shipments.updateMine(user.sub, id, dto);
    if (!shipment) {
      throw new NotFoundException('Nakliye kaydı bulunamadı');
    }
    return { shipment };
  }

  @Delete('mine/:id')
  async deleteMine(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this._deleteMineResponse(user.sub, id);
  }

  /// DELETE bazı proxy/sunucularda kapalı olabiliyor — mobil istemci yedek.
  @Post('mine/:id/delete')
  async deleteMinePost(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
  ) {
    return this._deleteMineResponse(user.sub, id);
  }

  private async _deleteMineResponse(userId: string, id: string) {
    const ok = await this.shipments.deleteMine(userId, id);
    if (!ok) {
      throw new NotFoundException('Nakliye kaydı bulunamadı');
    }
    return { ok: true };
  }
}

import { Module } from '@nestjs/common';
import { FreightShipmentsController } from './freight-shipments.controller';
import { FreightShipmentsService } from './freight-shipments.service';

@Module({
  controllers: [FreightShipmentsController],
  providers: [FreightShipmentsService],
  exports: [FreightShipmentsService],
})
export class FreightShipmentsModule {}

import { Module } from '@nestjs/common';
import { PreMarketController } from './premarket.controller.js';
import { PreMarketService } from './premarket.service.js';

@Module({
  controllers: [PreMarketController],
  providers: [PreMarketService],
  exports: [PreMarketService],
})
export class PreMarketModule {}

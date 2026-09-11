import { Module } from '@nestjs/common';
import { LiveController } from './live.controller.js';
import { LiveQuotesService } from './live-quotes.service.js';

@Module({
  controllers: [LiveController],
  providers: [LiveQuotesService],
  exports: [LiveQuotesService],
})
export class LiveModule {}

import { Module } from '@nestjs/common';
import { IposController } from './ipos.controller.js';
import { IposService } from './ipos.service.js';

@Module({
  controllers: [IposController],
  providers: [IposService],
  exports: [IposService],
})
export class IposModule {}

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StockEntity } from '../database/entities/stock.entity.js';
import { IposController } from './ipos.controller.js';
import { IposService } from './ipos.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([StockEntity])],
  controllers: [IposController],
  providers: [IposService],
  exports: [IposService],
})
export class IposModule {}


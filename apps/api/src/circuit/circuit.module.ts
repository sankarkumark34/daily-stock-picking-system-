import { Module } from '@nestjs/common';
import { CircuitController } from './circuit.controller.js';
import { CircuitService } from './circuit.service.js';

@Module({
  controllers: [CircuitController],
  providers: [CircuitService],
  exports: [CircuitService],
})
export class CircuitModule { }

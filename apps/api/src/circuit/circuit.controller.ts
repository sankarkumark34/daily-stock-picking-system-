import { Controller, Get, Post, Query } from '@nestjs/common';
import { CircuitService } from './circuit.service.js';

@Controller('circuit')
export class CircuitController {
  constructor(private readonly circuitService: CircuitService) { }

  @Get('predictions')
  getPredictions(
    @Query('band') band?: string,
    @Query('minProb') minProb?: string,
    @Query('sector') sector?: string,
    @Query('targetClass') targetClass?: 'uc' | 'lc',
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.circuitService.getPredictions({
      band: band ? Number(band) : undefined,
      minProb: minProb ? Number(minProb) : undefined,
      sector,
      targetClass,
      search,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('metrics')
  getMetrics() {
    return this.circuitService.getMetrics();
  }

  @Post('run')
  async runModel(@Query('sample') sample?: string) {
    return this.circuitService.runModel(sample ? Number(sample) : 300);
  }
}

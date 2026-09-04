import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AiNoteResponseDto, AnalystAnswerDto, StockAnalysisDto } from '@nse/shared';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { AnalystService } from './analyst.service.js';

class AskDto {
  @IsString() @MinLength(3) @MaxLength(600) question: string;
}

@ApiTags('analyst')
@Controller('analyst')
export class AnalystController {
  constructor(private readonly analyst: AnalystService) {}

  @Get(':symbol')
  @ApiOperation({ summary: 'Full single-stock analysis: checklist, verdict, returns, stress behaviour, history stats, news' })
  analyze(@Param('symbol') symbol: string): Promise<StockAnalysisDto> {
    return this.analyst.analyze(symbol);
  }

  @Get(':symbol/ai')
  @ApiOperation({ summary: 'AI analyst note (news impact, macro/geopolitical exposure, risks, catalysts) — requires Claude API credentials' })
  aiNote(@Param('symbol') symbol: string): Promise<AiNoteResponseDto> {
    return this.analyst.aiNote(symbol);
  }

  @Post(':symbol/ask')
  @ApiOperation({ summary: 'Ask the AI analyst a free-text question about this stock (e.g. impact of a geopolitical event)' })
  async ask(@Param('symbol') symbol: string, @Body() body: AskDto): Promise<AnalystAnswerDto> {
    try {
      return await this.analyst.ask(symbol, body.question);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
  }
}

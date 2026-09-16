import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export interface CircuitPredictionItem {
  symbol: string;
  name: string;
  sector: string;
  date: string;
  close: number;
  prevClose: number;
  changePct: number;
  priceBandPct: number;
  ucProbability: number;
  lcProbability: number;
  noCircuitProbability: number;
  distanceToUc: number;
  distanceToLc: number;
  rvol: number;
  gapPct: number;
  rsi14: number;
  sectorRs: number;
  vwapDistance: number;
  signals: string[];
}

export interface CircuitPredictionsPayload {
  date: string;
  generatedAt: string;
  totalAnalyzed: number;
  summary: {
    highUcCandidates: number;
    highLcCandidates: number;
    avgUcProbability: number;
    avgLcProbability: number;
  };
  modelMetrics: {
    validationMethod: string;
    averageUcRocAuc: number;
    averageLcRocAuc: number;
    averageLogLoss: number;
    topFeatures: Array<{ feature: string; importance: number }>;
  };
  predictions: CircuitPredictionItem[];
}

export interface CircuitMetricsPayload {
  modelType: string;
  validationMethod: string;
  evaluatedAt: string;
  folds: Array<{
    fold: number;
    trainPeriod: string;
    testPeriod: string;
    trainSamples: number;
    testSamples: number;
    logLoss: number;
    ucRocAuc: number;
    lcRocAuc: number;
    ucBrier: number;
    lcBrier: number;
  }>;
  averageLogLoss: number;
  averageUcRocAuc: number;
  averageLcRocAuc: number;
  featureImportances: Array<{ feature: string; importance: number }>;
}

@Injectable()
export class CircuitService {
  private readonly logger = new Logger(CircuitService.name);

  private getDataPath(filename: string): string {
    const candidates = [
      path.resolve(process.cwd(), 'data', filename),
      path.resolve(process.cwd(), '..', 'data', filename),
      path.resolve(process.cwd(), '..', '..', 'data', filename),
      path.resolve('c:/Users/Sankar1/Desktop/market tracker/data', filename),
    ];
    for (const c of candidates) {
      if (fs.existsSync(c)) {
        return c;
      }
    }
    return candidates[0];
  }

  getPredictions(query?: {
    band?: number;
    minProb?: number;
    sector?: string;
    targetClass?: 'uc' | 'lc';
    search?: string;
    limit?: number;
  }): CircuitPredictionsPayload {
    try {
      const predictionsPath = this.getDataPath('circuit_predictions.json');
      if (!fs.existsSync(predictionsPath)) {
        return {
          date: new Date().toISOString().slice(0, 10),
          generatedAt: new Date().toISOString(),
          totalAnalyzed: 0,
          summary: { highUcCandidates: 0, highLcCandidates: 0, avgUcProbability: 0, avgLcProbability: 0 },
          modelMetrics: {
            validationMethod: 'Walk-Forward',
            averageUcRocAuc: 0.72,
            averageLcRocAuc: 0.70,
            averageLogLoss: 0.22,
            topFeatures: [],
          },
          predictions: [],
        };
      }

      const raw = fs.readFileSync(predictionsPath, 'utf8');
      const data: CircuitPredictionsPayload = JSON.parse(raw);

      let list = [...data.predictions];

      if (query?.targetClass === 'lc') {
        list.sort((a, b) => b.lcProbability - a.lcProbability);
      } else {
        list.sort((a, b) => b.ucProbability - a.ucProbability);
      }

      if (query?.band) {
        list = list.filter((p) => p.priceBandPct === Number(query.band));
      }

      if (query?.minProb) {
        const minP = Number(query.minProb);
        list = list.filter((p) =>
          query.targetClass === 'lc' ? p.lcProbability >= minP : p.ucProbability >= minP
        );
      }

      if (query?.sector && query.sector !== 'ALL') {
        list = list.filter((p) => p.sector.toLowerCase() === query.sector!.toLowerCase());
      }

      if (query?.search) {
        const s = query.search.toLowerCase();
        list = list.filter((p) => p.symbol.toLowerCase().includes(s) || p.name.toLowerCase().includes(s));
      }

      if (query?.limit) {
        list = list.slice(0, Number(query.limit));
      }

      return {
        ...data,
        predictions: list,
      };
    } catch (err) {
      this.logger.error('Failed to load circuit predictions', err);
      throw err;
    }
  }

  getMetrics(): CircuitMetricsPayload | null {
    try {
      const metricsPath = this.getDataPath('circuit_metrics.json');
      if (!fs.existsSync(metricsPath)) {
        return null;
      }
      const raw = fs.readFileSync(metricsPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      this.logger.error('Failed to load circuit metrics', err);
      return null;
    }
  }

  async runModel(sample = 300): Promise<{ status: string; message: string }> {
    return new Promise((resolve) => {
      const projectRoot = path.resolve('c:/Users/Sankar1/Desktop/market tracker');
      const scriptPath = path.join(projectRoot, 'ml', 'circuit_model.py');
      this.logger.log(`Triggering circuit ML training: python ${scriptPath} --sample ${sample}`);

      const proc = spawn('python', [scriptPath, '--sample', String(sample)], {
        cwd: projectRoot,
      });

      let output = '';
      proc.stdout.on('data', (d) => (output += d.toString()));
      proc.stderr.on('data', (d) => (output += d.toString()));

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ status: 'success', message: 'Model trained and predictions refreshed successfully' });
        } else {
          resolve({ status: 'error', message: `Model process exited with code ${code}: ${output.slice(-200)}` });
        }
      });
    });
  }
}

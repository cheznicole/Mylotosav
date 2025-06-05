
export interface LotteryResult {
  id: string; // Added unique ID for easier CRUD
  date: string;
  winningNumbers: number[];
  machineNumbers: number[];
}

export interface NumberFrequency {
  number: number;
  frequency: number;
}

export interface CooccurrenceData {
  number: number;
  cooccurringNumbers: { number: number, frequency: number }[];
}

// AI Prediction types, mirrored from Genkit flows for easier use in frontend
export interface AIPrediction {
  predictedNumbers: number[];
  confidenceScores: number[];
  analysis?: string; // From generateLottoPredictions
}

export interface StrategyPrediction {
  predictedNumbers: number[];
  confidenceScores: number[];
  explanation?: string; // Added from prompt-for-lotto-strategy flow
}

// Added from the new lotteryApi.ts
export interface PredictionResult {
  bayesianProbabilities: { [key: number]: number };
  suggestedCombination: number[];
  successivePairs: Array<{ date1: string; date2: string; common_numbers: number[] }>;
}

// Type for DrawResult used in lotteryApi.ts, ensure consistency
export type { DrawResult as ApiDrawResult } from '@/services/lotteryApi';

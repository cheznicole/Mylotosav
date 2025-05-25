export interface LotteryResult {
  id: string;
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
}

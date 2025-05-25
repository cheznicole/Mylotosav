import type { LotteryResult, NumberFrequency, CooccurrenceData } from '@/types';

// Mock Lottery Results
const mockResults: LotteryResult[] = [
  {
    id: '1',
    date: '2024-07-20',
    winningNumbers: [5, 12, 23, 34, 45],
    machineNumbers: [1, 7],
  },
  {
    id: '2',
    date: '2024-07-17',
    winningNumbers: [8, 15, 22, 30, 49],
    machineNumbers: [3, 5],
  },
  {
    id: '3',
    date: '2024-07-13',
    winningNumbers: [2, 19, 28, 33, 40],
    machineNumbers: [6, 9],
  },
    {
    id: '4',
    date: '2024-07-10',
    winningNumbers: [5, 16, 25, 38, 55, 82],
    machineNumbers: [4, 8],
  },
  {
    id: '5',
    date: '2024-07-06',
    winningNumbers: [10, 21, 31, 42, 60, 77],
    machineNumbers: [2, 10],
  },
];

export const fetchLotteryResults = async (): Promise<LotteryResult[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockResults);
    }, 500);
  });
};

// Mock Number Frequency Data
const mockFrequencyData: NumberFrequency[] = Array.from({ length: 90 }, (_, i) => ({
  number: i + 1,
  frequency: Math.floor(Math.random() * 50) + 5,
})).sort((a, b) => b.frequency - a.frequency);

export const fetchNumberFrequencies = async (): Promise<NumberFrequency[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockFrequencyData);
    }, 500);
  });
};

// Mock Co-occurrence Data
const mockCooccurrenceData: CooccurrenceData[] = Array.from({ length: 10 }, (_, i) => ({
  number: mockFrequencyData[i].number,
  cooccurringNumbers: Array.from({ length: 5 }, () => ({
    number: Math.floor(Math.random() * 90) + 1,
    frequency: Math.floor(Math.random() * 10) + 1,
  })).filter(cn => cn.number !== mockFrequencyData[i].number)
   .sort((a,b) => b.frequency - a.frequency)
   .slice(0,3) // Show top 3 co-occurring
}));

export const fetchCooccurrenceData = async (): Promise<CooccurrenceData[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(mockCooccurrenceData);
    }, 500);
  });
};

// Helper to generate past results string for AI
export const getPastResultsStringForAI = (results: LotteryResult[]): string => {
  return results
    .slice(0, 10) // Use last 10 results or as needed
    .map(r => `Date: ${r.date}, Winning: ${r.winningNumbers.join(', ')}, Machine: ${r.machineNumbers.join(', ')}`)
    .join('; ');
};

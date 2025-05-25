
import axios, { type AxiosResponse } from 'axios';
import { parse } from 'date-fns';

// Interfaces
interface DrawSchedule {
  [day: string]: { [time: string]: string };
}

interface DrawResult {
  draw_name: string;
  date: string;
  gagnants: number[];
  machine?: number[];
}

interface AnalysisResult {
  frequencies: { [key: number]: number };
  coOccurrences: { [key: number]: { [key: number]: number } };
  successivePairs: Array<{ date1: string; date2: string; common_numbers: number[] }>;
  bayesianProbabilities: { [key: number]: number };
  suggestedCombination: number[];
}

interface Prediction {
  id?: number; // Optional: for IndexedDB autoIncrement
  draw_name: string;
  date: string;
  predicted: number[];
  actual?: number[];
}

// Calendrier des tirages
const DRAW_SCHEDULE: DrawSchedule = {
  Lundi: { '10H': 'Reveil', '13H': 'Etoile', '16H': 'Akwaba', '18H15': 'Monday Special' },
  Mardi: { '10H': 'La Matinale', '13H': 'Emergence', '16H': 'Sika', '18H15': 'Lucky Tuesday' },
  Mercredi: { '10H': 'Premiere Heure', '13H': 'Fortune', '16H': 'Baraka', '18H15': 'Midweek' },
  Jeudi: { '10H': 'Kado', '13H': 'Privilege', '16H': 'Monni', '18H15': 'Fortune Thursday' },
  Vendredi: { '10H': 'Cash', '13H': 'Solution', '16H': 'Wari', '18H15': 'Friday Bonanza' },
  Samedi: { '10H': 'Soutra', '13H': 'Diamant', '16H': 'Moaye', '18H15': 'National' },
  Dimanche: { '10H': 'Benediction', '13H': 'Prestige', '16H': 'Awale', '18H15': 'Espoir' },
};

// Récupération des résultats
export async function fetchLotteryResults(month?: string): Promise<DrawResult[]> {
  const baseUrl = 'https://lotobonheur.ci/api/results';
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    const response: AxiosResponse = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Referer: 'https://lotobonheur.ci/resultats',
      },
      timeout: 10000,
    });

    const resultsData = response.data;
    if (!resultsData.success) {
      console.error('API response not successful:', resultsData);
      throw new Error('Réponse API non réussie');
    }

    const drawsResultsWeekly = resultsData.drawsResultsWeekly;
    if (!drawsResultsWeekly || !Array.isArray(drawsResultsWeekly)) {
        console.warn('drawsResultsWeekly is not an array or is undefined. No results to process.');
        return []; // Return empty if no weekly results
    }

    const validDrawNames = new Set<string>();
    Object.values(DRAW_SCHEDULE).forEach(day => Object.values(day).forEach(drawName => validDrawNames.add(drawName)));

    const results: DrawResult[] = [];

    for (const week of drawsResultsWeekly) {
      if (!week.drawResultsDaily || !Array.isArray(week.drawResultsDaily)) {
          continue; // Skip if no daily results in this week
      }
      for (const dailyResult of week.drawResultsDaily) {
        const dateStr = dailyResult.date;
        let drawDate: string;

        try {
          // Expects format like "Lundi 29/07"
          const parts = dateStr.split(' ');
          if (parts.length < 2) {
            console.warn(`Unexpected date format: ${dateStr}`);
            continue;
          }
          const dayMonth = parts[1]; // Get "29/07"
          const [day, monthStr] = dayMonth.split('/');
          
          // The year 2025 is hardcoded as per user's original code.
          const parsedDate = parse(`${day}/${monthStr}/2025`, 'dd/MM/yyyy', new Date());
          drawDate = parsedDate.toISOString().split('T')[0];

        } catch (e) {
          console.warn(`Invalid date format: ${dateStr}, error: ${e}`);
          continue;
        }
        
        if (!dailyResult.drawResults || !Array.isArray(dailyResult.drawResults.standardDraws)) {
            continue; // Skip if no standard draws
        }

        for (const draw of dailyResult.drawResults.standardDraws) {
          const drawName = draw.drawName;
          // Ensure winningNumbers is a string before calling startsWith
          if (!validDrawNames.has(drawName) || (typeof draw.winningNumbers === 'string' && draw.winningNumbers.startsWith('.')) || typeof draw.winningNumbers !== 'string') {
            continue;
          }

          const winningNumbers = (draw.winningNumbers.match(/\d+/g) || []).map(Number).slice(0, 5);
          // Ensure machineNumbers is a string before calling match, or handle if it's not present/not a string
          const machineNumbersRaw = draw.machineNumbers;
          const machineNumbers = (typeof machineNumbersRaw === 'string' ? (machineNumbersRaw.match(/\d+/g) || []) : []).map(Number).slice(0, 5);


          if (winningNumbers.length === 5) {
            results.push({
              draw_name: drawName,
              date: drawDate,
              gagnants: winningNumbers,
              machine: machineNumbers.length === 5 ? machineNumbers : undefined,
            });
          } else {
            // console.warn(`Incomplete data for draw ${drawName}: winning numbers ${winningNumbers.length}, machine numbers ${machineNumbers.length}`);
          }
        }
      }
    }

    if (results.length === 0) {
      // This might be normal for some months, so not throwing an error.
      console.warn('Aucun résultat de tirage valide trouvé pour la période spécifiée.');
    }
    return results;
  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error(`Axios error fetching ${url}: ${error.message}`, error.toJSON());
    } else {
        console.error(`Error fetching ${url}:`, error);
    }
    throw new Error('Échec de la récupération des résultats');
  }
}

// Analyse fréquentielle
function analyzeFrequencies(draws: DrawResult[]): { [key: number]: number } {
  const allNumbers = draws.flatMap(draw => draw.gagnants);
  const frequency: { [key: number]: number } = {};
  allNumbers.forEach(num => { frequency[num] = (frequency[num] || 0) + 1; });
  return frequency;
}

// Analyse des co-occurrences
function analyzeCoOccurrences(draws: DrawResult[], targetNumber?: number): { [key: number]: { [key: number]: number } } {
  const coOccurrences: { [key: number]: { [key: number]: number } } = {};
  draws.forEach(draw => {
    draw.gagnants.forEach(num1 => {
      if (!targetNumber || num1 === targetNumber) {
        if (!coOccurrences[num1]) coOccurrences[num1] = {};
        draw.gagnants.forEach(num2 => {
          if (num1 !== num2) {
            coOccurrences[num1][num2] = (coOccurrences[num1][num2] || 0) + 1;
          }
        });
      }
    });
  });
  return coOccurrences;
}

// Analyse des tirages successifs
function analyzeSuccessivePairs(draws: DrawResult[]): Array<{ date1: string; date2: string; common_numbers: number[] }> {
  const pairs: Array<{ date1: string; date2: string; common_numbers: number[] }> = [];
  // Ensure draws are sorted by date for correct successive analysis
  const sortedDraws = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (let i = 0; i < sortedDraws.length - 1; i++) {
    const currentDraw = new Set(sortedDraws[i].gagnants);
    const nextDraw = new Set(sortedDraws[i + 1].gagnants);
    const commonNumbers = [...currentDraw].filter(num => nextDraw.has(num));
    if (commonNumbers.length > 0) {
      pairs.push({
        date1: sortedDraws[i].date,
        date2: sortedDraws[i + 1].date,
        common_numbers: commonNumbers,
      });
    }
  }
  return pairs;
}

// Modélisation bayésienne avec apprentissage des erreurs
function bayesianProbabilities(frequencies: { [key: number]: number }, pastPredictions: Prediction[]): { [key: number]: number } {
  const totalWinningNumbers = Object.values(frequencies).reduce((sum, count) => sum + count, 0);
  // Assuming 5 winning numbers per draw. If this can vary, this logic needs adjustment.
  const totalDraws = totalWinningNumbers > 0 ? totalWinningNumbers / 5 : 0; 
  
  const probabilities: { [key: number]: number } = {};
  const alpha = 1; // Laplace smoothing parameter (prior count)
  const N = 90; // Total possible numbers

  for (let num = 1; num <= N; num++) {
    const observedCount = frequencies[num] || 0;
    let adjustment = 0; // Error learning adjustment

    // Error learning from past predictions
    pastPredictions.forEach(pred => {
      if (pred.actual) { // Only consider predictions where actual results are known
        const predictedIncludesNum = pred.predicted.includes(num);
        const actualIncludesNum = pred.actual.includes(num);

        if (predictedIncludesNum && !actualIncludesNum) { // False Positive
          adjustment -= 0.05; // Penalize if predicted but not drawn
        } else if (!predictedIncludesNum && actualIncludesNum) { // False Negative
          adjustment += 0.05; // Reward if not predicted but drawn (missed hit)
        }
        // True positives and true negatives don't directly adjust, but influence future frequency-based calculation
      }
    });
    
    // Apply Bayesian probability with Laplace smoothing and adjustment
    // P(num) = (observedCount + alpha + adjustment_scaled) / (totalDraws + N * alpha)
    // The adjustment needs careful scaling. Let's apply it as a small shift to the observed count.
    // We must ensure the adjusted count remains non-negative.
    const adjustedObservedCount = Math.max(0, observedCount + adjustment * totalDraws); // Scale adjustment by totalDraws

    probabilities[num] = (adjustedObservedCount + alpha) / (totalDraws + N * alpha);
  }
  return probabilities;
}

// Génération de combinaison
function generateCombination(probabilities: { [key: number]: number }): number[] {
  const numbers = Object.keys(probabilities).map(Number);
  const probs = Object.values(probabilities);
  
  // Ensure probabilities are non-negative and sum to a positive value
  const cleanedProbs = probs.map(p => Math.max(0, p));
  const totalProbSum = cleanedProbs.reduce((sum, p) => sum + p, 0);

  if (totalProbSum <= 0) {
    // Fallback: if all probabilities are zero or negative, return a random unique set or handle error
    console.warn("Cannot generate combination: total probability sum is not positive. Returning random set.");
    const set = new Set<number>();
    while(set.size < 5) {
        set.add(Math.floor(Math.random() * 90) + 1);
    }
    return Array.from(set).sort((a,b) => a-b);
  }

  const combination: number[] = [];
  const availableNumbers = [...numbers];
  const availableProbs = [...cleanedProbs];

  while (combination.length < 5 && availableNumbers.length > 0) {
    const currentTotal = availableProbs.reduce((sum, w) => sum + w, 0);
    if (currentTotal <= 0) break; // Should not happen if initial check passed, but as a safeguard

    const r = Math.random() * currentTotal;
    let cumulativeProb = 0;
    let chosenIndex = -1;

    for (let i = 0; i < availableNumbers.length; i++) {
      cumulativeProb += availableProbs[i];
      if (r <= cumulativeProb) {
        chosenIndex = i;
        break;
      }
    }
    
    if (chosenIndex !== -1) {
      combination.push(availableNumbers[chosenIndex]);
      availableNumbers.splice(chosenIndex, 1); // Remove chosen number
      availableProbs.splice(chosenIndex, 1); // Remove its probability
    } else if (availableNumbers.length > 0) {
        // Fallback if somehow no number is chosen (e.g. floating point issues with r exactly matching total)
        // Pick the one with highest remaining probability or just the first one
        let fallbackIndex = 0;
        if(availableProbs.length > 0) {
            fallbackIndex = availableProbs.indexOf(Math.max(...availableProbs));
        }
        combination.push(availableNumbers[fallbackIndex]);
        availableNumbers.splice(fallbackIndex, 1);
        availableProbs.splice(fallbackIndex, 1);
    }
  }
  return combination.sort((a, b) => a - b);
}


// --- IndexedDB Functions ---
// WARNING: IndexedDB is a browser-only API and will not work in Node.js (server-side) environments.

const DB_NAME = 'LotoAnalyseDB';
const DB_VERSION = 1;
const PREDICTIONS_STORE_NAME = 'predictions';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PREDICTIONS_STORE_NAME)) {
        db.createObjectStore(PREDICTIONS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = event => {
      resolve((event.target as IDBOpenDBRequest).result);
    };
    request.onerror = event => {
      reject(new Error(`Database error: ${(event.target as IDBOpenDBRequest).error?.message}`));
    };
  });
}

export async function savePrediction(prediction: Prediction): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
    const request = store.add(prediction);
    request.onsuccess = () => resolve();
    request.onerror = (event) => reject(new Error(`Failed to save prediction: ${(event.target as IDBRequest).error?.message}`));
    transaction.oncomplete = () => db.close(); // Close DB after transaction
    transaction.onerror = (event) => reject(new Error(`Transaction error: ${(event.target as IDBTransaction).error?.message}`));

  });
}

export async function getPastPredictions(): Promise<Prediction[]> {
   try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        resolve(request.result as Prediction[]);
      };
      request.onerror = (event) => {
        reject(new Error(`Failed to retrieve predictions: ${(event.target as IDBRequest).error?.message}`));
      };
      transaction.oncomplete = () => db.close(); // Close DB after transaction
      transaction.onerror = (event) => reject(new Error(`Transaction error: ${(event.target as IDBTransaction).error?.message}`));
    });
  } catch (error) {
     // This catch block handles errors from openDB() or if IndexedDB is not supported
    console.warn(`Could not get past predictions: ${error instanceof Error ? error.message : String(error)}. Returning empty array.`);
    return []; // Return empty array if DB access fails
  }
}

// Analyse complète
export async function analyzeLotteryResults(month?: string): Promise<AnalysisResult> {
  const draws = await fetchLotteryResults(month);
  const pastPredictions = await getPastPredictions(); // Will be empty array if IndexedDB is not available
  
  const frequencies = analyzeFrequencies(draws);
  const coOccurrences = analyzeCoOccurrences(draws);
  const successivePairs = analyzeSuccessivePairs(draws);
  const bayesianProbabilitiesResult = bayesianProbabilities(frequencies, pastPredictions);
  const suggestedCombination = generateCombination(bayesianProbabilitiesResult);

  return {
    frequencies,
    coOccurrences,
    successivePairs,
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination,
  };
}

    
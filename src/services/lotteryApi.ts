
import axios, { type AxiosResponse } from 'axios';
import { parse, getYear, isValid, format } from 'date-fns';
import type { PredictionResult as PredictionResultType } from '@/types'; // Import shared type

// Interfaces
export interface DrawResult {
  id: string; // Unique ID for each draw result
  draw_name: string;
  date: string; // YYYY-MM-DD format
  gagnants: number[]; // Must be 5 numbers (1-90)
  machine?: number[]; // 0-5 numbers (1-90)
}

export interface Prediction {
  id?: number; // Optional: for IndexedDB autoIncrement
  draw_name: string;
  date: string;
  predicted: number[];
  actual?: number[];
}

// Calendrier des tirages - Exported for use in sidebar and filters
export const DRAW_SCHEDULE: { [day: string]: { [time: string]: string } }  = {
  Lundi: { '10H': 'Reveil', '13H': 'Etoile', '16H': 'Akwaba', '18H15': 'Monday Special' },
  Mardi: { '10H': 'La Matinale', '13H': 'Emergence', '16H': 'Sika', '18H15': 'Lucky Tuesday' },
  Mercredi: { '10H': 'Premiere Heure', '13H': 'Fortune', '16H': 'Baraka', '18H15': 'Midweek' },
  Jeudi: { '10H': 'Kado', '13H': 'Privilege', '16H': 'Monni', '18H15': 'Fortune Thursday' },
  Vendredi: { '10H': 'Cash', '13H': 'Solution', '16H': 'Wari', '18H15': 'Friday Bonanza' },
  Samedi: { '10H': 'Soutra', '13H': 'Diamant', '16H': 'Moaye', '18H15': 'National' },
  Dimanche: { '10H': 'Benediction', '13H': 'Prestige', '16H': 'Awale', '18H15': 'Espoir' },
};

let adminOverriddenResults: DrawResult[] | null = null;
let isDataFetchedFromApi = false;

// Récupération des résultats de l'API - Exported
export async function fetchLotteryResults(month?: string): Promise<DrawResult[]> {
  if (adminOverriddenResults !== null && !month) { 
    return [...adminOverriddenResults].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  
  if (adminOverriddenResults !== null && isDataFetchedFromApi && month){
     const [year, monthValue] = month.split('-').map(Number);
     return adminOverriddenResults.filter(r => {
        const rDate = new Date(r.date);
        return rDate.getFullYear() === year && rDate.getMonth() + 1 === monthValue;
     }).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  const baseUrl = 'https://lotobonheur.ci/api/results';
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    const response: AxiosResponse = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
        Referer: 'https://lotobonheur.ci/resultats',
      },
      timeout: 15000,
    });

    const resultsData = response.data;
    if (!resultsData.success) {
      console.error('API response not successful:', resultsData);
      throw new Error('Réponse API non réussie');
    }
    
    const drawsResultsWeekly = resultsData.drawsResultsWeekly;
    if (!drawsResultsWeekly || !Array.isArray(drawsResultsWeekly)) {
        console.warn('drawsResultsWeekly is not an array or is undefined. No results to process from API.');
        if (adminOverriddenResults === null && !month) adminOverriddenResults = []; 
        return adminOverriddenResults ? [...adminOverriddenResults].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
    }

    const validDrawNames = new Set<string>();
    Object.values(DRAW_SCHEDULE).forEach(daySchedule => Object.values(daySchedule).forEach(drawName => validDrawNames.add(drawName)));

    const fetchedResults: DrawResult[] = [];
    const currentSystemYear = getYear(new Date());

    for (const week of drawsResultsWeekly) {
      if (!week.drawResultsDaily || !Array.isArray(week.drawResultsDaily)) {
          continue; 
      }
      for (const dailyResult of week.drawResultsDaily) {
        const dateStr = dailyResult.date; 
        let drawDate: string;

        try {
          const parts = dateStr.split(' ');
          if (parts.length < 2) {
            console.warn(`Unexpected date format from API: ${dateStr}`);
            continue;
          }
          const dayMonth = parts[1]; 
          const [dayStr, monthStr] = dayMonth.split('/');
          
          const parsedDate = parse(`${dayStr}/${monthStr}/${currentSystemYear}`, 'dd/MM/yyyy', new Date());
          if (!isValid(parsedDate)) {
            console.warn(`Invalid parsed date for: ${dateStr} with year ${currentSystemYear}`);
            continue;
          }
          drawDate = format(parsedDate, 'yyyy-MM-dd');

        } catch (e) {
          console.warn(`Error parsing date format from API: ${dateStr}, error: ${e instanceof Error ? e.message : String(e)}`);
          continue;
        }
        
        if (!dailyResult.drawResults || !dailyResult.drawResults.standardDraws || !Array.isArray(dailyResult.drawResults.standardDraws)) {
            continue; 
        }

        for (const draw of dailyResult.drawResults.standardDraws) {
          const drawName = draw.drawName;
          
          if (!validDrawNames.has(drawName) || typeof draw.winningNumbers !== 'string' || draw.winningNumbers.startsWith('.')) {
            continue;
          }

          const winningNumbers = (draw.winningNumbers.match(/\d+/g) || []).map(Number).filter(n => n >= 1 && n <= 90);
          const machineNumbersRaw = draw.machineNumbers;
          const machineNumbers = (typeof machineNumbersRaw === 'string' ? (machineNumbersRaw.match(/\d+/g) || []) : []).map(Number).filter(n => n >= 1 && n <= 90);

          if (winningNumbers.length === 5) { // Main validation for a usable result
            fetchedResults.push({
              id: crypto.randomUUID(), 
              draw_name: drawName,
              date: drawDate,
              gagnants: winningNumbers,
              machine: machineNumbers.length > 0 ? machineNumbers : undefined,
            });
          }
        }
      }
    }
    
    if (!month) { 
        adminOverriddenResults = [...fetchedResults]; 
        isDataFetchedFromApi = true;
    }

    if (fetchedResults.length === 0 && !month) {
      console.warn('Aucun résultat de tirage valide trouvé via API pour la période générale.');
    }
    return fetchedResults.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error(`Axios error fetching ${url}: ${error.message}`, error.response?.data || error.toJSON());
    } else {
        console.error(`Error fetching ${url}:`, error);
    }
    if (adminOverriddenResults === null && !month) adminOverriddenResults = [];
    return adminOverriddenResults ? [...adminOverriddenResults].sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()) : [];
  }
}

// Helper to compare if two number arrays are identical (order-independent)
const compareNumberArrays = (arr1?: number[], arr2?: number[]): boolean => {
  if (arr1 === undefined && arr2 === undefined) return true; // Both undefined
  if (arr1 === undefined || arr2 === undefined) return false; // One is undefined, other is not
  if (arr1.length === 0 && arr2.length === 0) return true; // Both empty
  if (arr1.length !== arr2.length) return false;
  const sorted1 = [...arr1].sort((a, b) => a - b).join(',');
  const sorted2 = [...arr2].sort((a, b) => a - b).join(',');
  return sorted1 === sorted2;
};

// Helper to check if two DrawResult objects are identical (excluding ID)
const areResultsIdentical = (res1: Omit<DrawResult, 'id'>, res2: Omit<DrawResult, 'id'>): boolean => {
  return res1.draw_name === res2.draw_name &&
         res1.date === res2.date &&
         compareNumberArrays(res1.gagnants, res2.gagnants) &&
         compareNumberArrays(res1.machine, res2.machine);
};


// Admin CRUD functions
export async function addLotteryResult(newResultData: Omit<DrawResult, 'id'>): Promise<DrawResult> {
  if (adminOverriddenResults === null) {
    await fetchLotteryResults(); 
  }
  // Check for duplicates before adding
  if (adminOverriddenResults && adminOverriddenResults.some(existingResult => areResultsIdentical(existingResult, newResultData))) {
    throw new Error("Duplicate result: This lottery result already exists.");
  }

  const newResult: DrawResult = { ...newResultData, id: crypto.randomUUID() };
  adminOverriddenResults = [...(adminOverriddenResults || []), newResult];
  adminOverriddenResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return newResult;
}

export async function addMultipleDrawResults(
  newRawResults: Array<Omit<DrawResult, 'id'>>
): Promise<{ added: DrawResult[]; duplicates: number }> {
  if (adminOverriddenResults === null) {
    await fetchLotteryResults(); 
  }
  const addedResults: DrawResult[] = [];
  let duplicateCount = 0;

  newRawResults.forEach(rawResult => {
    // Ensure 'gagnants' always has 5 valid numbers and 'machine' has 0-5 valid numbers.
    // This validation should ideally be done before calling this function (e.g., in AdminImageImport)
    // but we can add a basic check here as a safeguard.
    if (!rawResult.gagnants || rawResult.gagnants.length !== 5 || !rawResult.gagnants.every(n => n >= 1 && n <= 90)) {
        console.warn("Skipping invalid raw result due to 'gagnants' criteria in addMultipleDrawResults:", rawResult);
        return; // Skip this result
    }
    if (rawResult.machine && !rawResult.machine.every(n => n >= 1 && n <= 90)) {
        console.warn("Skipping invalid raw result due to 'machine' criteria in addMultipleDrawResults:", rawResult);
        return; // Skip this result
    }


    const isDuplicate = adminOverriddenResults?.some(existingResult =>
      areResultsIdentical(existingResult, rawResult)
    ) || false;

    if (isDuplicate) {
      duplicateCount++;
    } else {
      const newResult: DrawResult = { ...rawResult, id: crypto.randomUUID() };
      adminOverriddenResults = [...(adminOverriddenResults || []), newResult];
      addedResults.push(newResult);
    }
  });

  if (adminOverriddenResults) {
    adminOverriddenResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }
  return { added: addedResults, duplicates: duplicateCount };
}


export async function updateLotteryResult(updatedResult: DrawResult): Promise<DrawResult> {
  if (adminOverriddenResults === null) {
    throw new Error("No results loaded to update.");
  }
  const index = adminOverriddenResults.findIndex(r => r.id === updatedResult.id);
  if (index === -1) {
    throw new Error(`Result with id ${updatedResult.id} not found.`);
  }
  adminOverriddenResults[index] = updatedResult;
  adminOverriddenResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  return updatedResult;
}

export async function deleteLotteryResult(resultId: string): Promise<void> {
  if (adminOverriddenResults === null) {
    return; 
  }
  adminOverriddenResults = adminOverriddenResults.filter(r => r.id !== resultId);
}

export async function setAllLotteryResults(results: DrawResult[]): Promise<void> {
  adminOverriddenResults = results.map(r => ({...r, id: r.id || crypto.randomUUID() }));
  isDataFetchedFromApi = true; 
  adminOverriddenResults.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export async function getAllLotteryResultsForExport(): Promise<DrawResult[]> {
  if (adminOverriddenResults === null) {
    await fetchLotteryResults(); 
  }
  return adminOverriddenResults ? [...adminOverriddenResults] : [];
}

export async function clearAdminCache(): Promise<void> {
  adminOverriddenResults = null;
  isDataFetchedFromApi = false; // Reset this flag so next fetch goes to API
}


// Analyse fréquentielle - Exported for statistics page
export function analyzeFrequencies(draws: DrawResult[]): { [key: number]: number } {
  const allNumbers = draws.flatMap(draw => draw.gagnants);
  const frequency: { [key: number]: number } = {};
  for (let i = 1; i <= 90; i++) { 
    frequency[i] = 0;
  }
  allNumbers.forEach(num => { 
    if (num >=1 && num <= 90) { 
      frequency[num] = (frequency[num] || 0) + 1; 
    }
  });
  return frequency;
}

// Analyse des tirages successifs
function analyzeSuccessivePairs(draws: DrawResult[]): Array<{ date1: string; date2: string; common_numbers: number[] }> {
  const pairs: Array<{ date1: string; date2: string; common_numbers: number[] }> = [];
  const sortedDraws = [...draws].sort((a, b) => {
    const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateComparison !== 0) return dateComparison;
    return a.draw_name.localeCompare(b.draw_name);
  });

  for (let i = 0; i < sortedDraws.length - 1; i++) {
    if (sortedDraws[i].draw_name === sortedDraws[i+1].draw_name) { 
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
  }
  return pairs;
}

// Modélisation bayésienne avec apprentissage des erreurs
function bayesianProbabilities(frequencies: { [key: number]: number }, pastPredictions: Prediction[]): { [key: number]: number } {
  const totalWinningNumbers = Object.values(frequencies).reduce((sum, count) => sum + count, 0);
  const totalDraws = totalWinningNumbers > 0 ? Math.max(1, totalWinningNumbers / 5) : 0; 
  
  const probabilities: { [key: number]: number } = {};
  const alpha = 1; 
  const N = 90; 

  for (let num = 1; num <= N; num++) {
    const observedCount = frequencies[num] || 0;
    let errorAdjustmentScore = 0; 

    pastPredictions.forEach(pred => {
      if (pred.actual) { 
        if (pred.predicted.includes(num) && !pred.actual.includes(num)) errorAdjustmentScore -= 0.05; 
        if (!pred.predicted.includes(num) && pred.actual.includes(num)) errorAdjustmentScore += 0.05; 
      }
    });
    
    const adjustedObservedCount = Math.max(0, observedCount + (observedCount * errorAdjustmentScore)); 

    probabilities[num] = (adjustedObservedCount + alpha) / (totalDraws + N * alpha);
    if(probabilities[num] < 0) probabilities[num] = 0; 
  }
  return probabilities;
}

// Génération de combinaison
function generateCombination(probabilities: { [key: number]: number }): number[] {
  const numbers = Object.keys(probabilities).map(Number).filter(n => n >= 1 && n <=90);
  
  const popularNumbers = [1, 2, 3, 4, 5, 7, 13, 15, 23, 27, 31]; 
  const adjustedProbabilitiesMap: {[key: number]: number } = {};
  
  numbers.forEach(num => {
      adjustedProbabilitiesMap[num] = Math.max(0, popularNumbers.includes(num) ? (probabilities[num] || 0) * 0.8 : (probabilities[num] || 0));
  });

  let availableNumbers = Object.keys(adjustedProbabilitiesMap).map(Number);
  let availableProbs = availableNumbers.map(num => Math.max(0, adjustedProbabilitiesMap[num] || 0)); 

  const combination: number[] = [];
  
  if (availableNumbers.length < 5) { 
    console.warn("Not enough unique numbers with positive probability for weighted selection. Filling randomly.");
    const randomSet = new Set<number>();
    let sourceForRandom = availableNumbers.length > 0 ? [...availableNumbers] : Array.from({length: 90}, (_, i) => i + 1);
    
    while(randomSet.size < 5 && sourceForRandom.length > 0) {
        const randomIndex = Math.floor(Math.random() * sourceForRandom.length);
        randomSet.add(sourceForRandom.splice(randomIndex, 1)[0]);
    }
    return Array.from(randomSet).sort((a,b) => a-b);
  }

  for (let k=0; k<5; k++) {
    const currentTotalProbSum = availableProbs.reduce((sum, p) => sum + p, 0);
    if (currentTotalProbSum <= 0) { 
        const remainingAvailableForFill = availableNumbers.filter(n => !combination.includes(n));
        while(combination.length < 5 && remainingAvailableForFill.length > 0) {
            const randIdx = Math.floor(Math.random() * remainingAvailableForFill.length);
            combination.push(remainingAvailableForFill.splice(randIdx, 1)[0]);
        }
        break; 
    }

    const r = Math.random() * currentTotalProbSum;
    let cumulativeProb = 0;
    let chosenIndex = -1;

    for (let i = 0; i < availableNumbers.length; i++) {
      cumulativeProb += availableProbs[i];
      if (r <= cumulativeProb) {
        chosenIndex = i;
        break;
      }
    }
    
    if (chosenIndex !== -1 && availableNumbers[chosenIndex] !== undefined) {
      combination.push(availableNumbers[chosenIndex]);
      availableNumbers.splice(chosenIndex, 1); 
      availableProbs.splice(chosenIndex, 1); 
    } else if (availableNumbers.length > 0) { 
        let fallbackIndex = Math.floor(Math.random() * availableNumbers.length);
        combination.push(availableNumbers[fallbackIndex]);
        availableNumbers.splice(fallbackIndex, 1);
        if (availableProbs.length > fallbackIndex) availableProbs.splice(fallbackIndex, 1);
    } else {
      break; 
    }
  }
  return combination.sort((a, b) => a - b);
}

// --- IndexedDB ---
const DB_NAME = 'LotoAnalyseDB';
const DB_VERSION = 1;
const PREDICTIONS_STORE_NAME = 'predictions_v1'; 

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      console.warn('IndexedDB is not supported in this environment. Prediction history will not be saved.');
      return reject(new Error('IndexedDB is not supported.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PREDICTIONS_STORE_NAME)) {
        const store = db.createObjectStore(PREDICTIONS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('drawNameDateIndex', ['draw_name', 'date'], { unique: false });
      }
    };
    request.onsuccess = event => resolve((event.target as IDBOpenDBRequest).result);
    request.onerror = event => reject(new Error(`Database error: ${(event.target as IDBOpenDBRequest).error?.message}`));
  });
}

export async function savePrediction(prediction: Omit<Prediction, 'id'>): Promise<number> {
 try {
    const db = await openDB();
    return new Promise<number>((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const addRequest = store.add(prediction); 
      addRequest.onsuccess = () => resolve(addRequest.result as number);
      addRequest.onerror = (event) => reject(new Error(`Failed to save prediction: ${(event.target as IDBRequest).error?.message}`));
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => {
        console.error("Transaction error (savePrediction):", (event.target as IDBTransaction).error);
        reject(new Error(`Transaction error (save): ${(event.target as IDBTransaction).error?.message}`));
      };
    });
  } catch (error) {
    console.warn(`Could not save prediction (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}`);
    throw error; 
  }
}

export async function getPastPredictions(drawName?: string): Promise<Prediction[]> {
   try {
    const db = await openDB();
    return new Promise<Prediction[]>((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const request = store.getAll(); 
      
      request.onsuccess = () => {
        let results = (request.result || []) as Prediction[];
        if (drawName) {
            results = results.filter(p => p && p.draw_name === drawName);
        }
        resolve(results);
      };
      request.onerror = (event) => reject(new Error(`Failed to retrieve predictions: ${(event.target as IDBRequest).error?.message}`));
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => {
        console.error("Transaction error (getPastPredictions):", (event.target as IDBTransaction).error);
        reject(new Error(`Transaction error (get): ${(event.target as IDBTransaction).error?.message}`));
      };
    });
  } catch (error) {
    console.warn(`Could not get past predictions (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}. Returning empty array.`);
    return []; 
  }
}

export async function updatePredictionActual(id: number, actual: number[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const getRequest = store.get(id);

      getRequest.onsuccess = () => {
        const prediction = getRequest.result as Prediction | undefined;
        if (prediction) {
          prediction.actual = actual;
          const putRequest = store.put(prediction);
          putRequest.onsuccess = () => resolve();
          putRequest.onerror = (event) => reject(new Error(`Failed to update prediction (put): ${(event.target as IDBRequest).error?.message}`));
        } else {
          reject(new Error('Prediction not found for update. ID: ' + id));
        }
      };
      getRequest.onerror = (event) => reject(new Error(`Failed to get prediction for update: ${(event.target as IDBRequest).error?.message}`));
      
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => {
         console.error("Transaction error (updatePredictionActual):", (event.target as IDBTransaction).error);
         reject(new Error(`Transaction error (update): ${(event.target as IDBTransaction).error?.message}`));
      };
    });
  } catch (error) {
     console.warn(`Could not update prediction (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}`);
     throw error;
  }
}

export async function clearAllPredictions(): Promise<void> {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const clearRequest = store.clear();
      clearRequest.onsuccess = () => resolve();
      clearRequest.onerror = (event) => reject(new Error(`Failed to clear predictions: ${(event.target as IDBRequest).error?.message}`));
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => {
        console.error("Transaction error (clearAllPredictions):", (event.target as IDBTransaction).error);
        reject(new Error(`Transaction error (clear predictions): ${(event.target as IDBTransaction).error?.message}`));
      };
    });
  } catch (error) {
    console.warn(`Could not clear predictions (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}`);
    // Do not re-throw, allow UI to report success if DB is just unavailable
  }
}

// Fonction principale pour générer une prédiction - Exported
export async function generatePrediction(drawName: string, month?: string): Promise<PredictionResultType> {
  const draws = await fetchLotteryResults(month); 
  const filteredDraws = draws.filter(draw => draw.draw_name === drawName);
  
  if (filteredDraws.length === 0) {
      console.warn(`No historical data found for draw '${drawName}' for the specified period/filters to generate prediction.`);
      return { 
          bayesianProbabilities: {},
          suggestedCombination: [],
          successivePairs: []
      };
  }

  const frequencies = analyzeFrequencies(filteredDraws);
  const successivePairs = analyzeSuccessivePairs(filteredDraws);
  const pastPredictions = await getPastPredictions(drawName); 
  const bayesianProbabilitiesResult = bayesianProbabilities(frequencies, pastPredictions);
  const suggestedCombinationResult = generateCombination(bayesianProbabilitiesResult);

  return {
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination: suggestedCombinationResult,
    successivePairs: successivePairs,
  };
}


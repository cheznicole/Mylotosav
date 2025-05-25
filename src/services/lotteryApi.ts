
import axios, { type AxiosResponse } from 'axios';
import { parse, getYear } from 'date-fns';

// Interfaces
export interface DrawResult { // Exporting for use in components
  draw_name: string;
  date: string; // YYYY-MM-DD format
  gagnants: number[];
  machine?: number[];
}

interface Prediction {
  id?: number; // Optional: for IndexedDB autoIncrement
  draw_name: string;
  date: string;
  predicted: number[];
  actual?: number[];
}

export interface PredictionResult { // Exporting for use in types
  bayesianProbabilities: { [key: number]: number };
  suggestedCombination: number[];
  successivePairs: Array<{ date1: string; date2: string; common_numbers: number[] }>;
}

// Calendrier des tirages - Moved to top level and exported
export const DRAW_SCHEDULE = {
  Lundi: { '10H': 'Reveil', '13H': 'Etoile', '16H': 'Akwaba', '18H15': 'Monday Special' },
  Mardi: { '10H': 'La Matinale', '13H': 'Emergence', '16H': 'Sika', '18H15': 'Lucky Tuesday' },
  Mercredi: { '10H': 'Premiere Heure', '13H': 'Fortune', '16H': 'Baraka', '18H15': 'Midweek' },
  Jeudi: { '10H': 'Kado', '13H': 'Privilege', '16H': 'Monni', '18H15': 'Fortune Thursday' },
  Vendredi: { '10H': 'Cash', '13H': 'Solution', '16H': 'Wari', '18H15': 'Friday Bonanza' },
  Samedi: { '10H': 'Soutra', '13H': 'Diamant', '16H': 'Moaye', '18H15': 'National' },
  Dimanche: { '10H': 'Benediction', '13H': 'Prestige', '16H': 'Awale', '18H15': 'Espoir' },
};

// Récupération des résultats de l'API - Exported
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
      timeout: 15000, // Increased timeout
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
    const currentYear = getYear(new Date()); // Get current year dynamically

    for (const week of drawsResultsWeekly) {
      if (!week.drawResultsDaily || !Array.isArray(week.drawResultsDaily)) {
          continue; 
      }
      for (const dailyResult of week.drawResultsDaily) {
        const dateStr = dailyResult.date; // e.g., "Lundi 29/07"
        let drawDate: string;

        try {
          const parts = dateStr.split(' ');
          if (parts.length < 2) {
            console.warn(`Unexpected date format: ${dateStr}`);
            continue;
          }
          const dayMonth = parts[1]; 
          const [day, monthStr] = dayMonth.split('/');
          
          const parsedDate = parse(`${day}/${monthStr}/${currentYear}`, 'dd/MM/yyyy', new Date());
          drawDate = parsedDate.toISOString().split('T')[0]; // YYYY-MM-DD

        } catch (e) {
          console.warn(`Invalid date format: ${dateStr}, error: ${e instanceof Error ? e.message : String(e)}`);
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

          const winningNumbers = (draw.winningNumbers.match(/\d+/g) || []).map(Number).slice(0, 5);
          
          const machineNumbersRaw = draw.machineNumbers;
          const machineNumbers = (typeof machineNumbersRaw === 'string' ? (machineNumbersRaw.match(/\d+/g) || []) : []).map(Number).slice(0, 5);

          if (winningNumbers.length === 5) { // As per requirement: 5 winning numbers
            results.push({
              draw_name: drawName,
              date: drawDate,
              gagnants: winningNumbers,
              machine: machineNumbers.length > 0 ? machineNumbers : undefined,
            });
          }
        }
      }
    }

    if (results.length === 0) {
      // Changed from throw to console.warn to allow UI to handle "no data"
      console.warn('Aucun résultat de tirage valide trouvé pour la période spécifiée via API.');
    }
    // Sort by date descending, then by draw name for consistency
    return results.sort((a,b) => {
        const dateComparison = new Date(b.date).getTime() - new Date(a.date).getTime();
        if (dateComparison !== 0) return dateComparison;
        return a.draw_name.localeCompare(b.draw_name);
    });

  } catch (error) {
    if (axios.isAxiosError(error)) {
        console.error(`Axios error fetching ${url}: ${error.message}`, error.response?.data || error.toJSON());
    } else {
        console.error(`Error fetching ${url}:`, error);
    }
    // Return empty array on error to allow components to handle empty state
    return [];
  }
}

// Analyse fréquentielle - Exported
export function analyzeFrequencies(draws: DrawResult[]): { [key: number]: number } {
  const allNumbers = draws.flatMap(draw => draw.gagnants);
  const frequency: { [key: number]: number } = {};
  for (let i = 1; i <= 90; i++) { // Initialize all numbers from 1 to 90
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
  // Ensure draws are sorted by date for correct successive analysis
  const sortedDraws = [...draws].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  for (let i = 0; i < sortedDraws.length - 1; i++) {
    // Only compare if draws are for the same draw_name
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
  const totalDraws = totalWinningNumbers > 0 ? totalWinningNumbers / 5 : 0; // Assuming 5 winning numbers per draw
  
  const probabilities: { [key: number]: number } = {};
  const alpha = 1; // Laplace smoothing parameter (prior count)
  const N = 90; // Total possible numbers (1-90)

  for (let num = 1; num <= N; num++) {
    const observedCount = frequencies[num] || 0;
    let adjustment = 0; 

    pastPredictions.forEach(pred => {
      if (pred.actual) { 
        // Pénalité pour les numéros prédits incorrectement
        if (pred.predicted.includes(num) && !pred.actual.includes(num)) adjustment -= 0.05;
        // Bonus pour les numéros manqués
        if (!pred.predicted.includes(num) && pred.actual.includes(num)) adjustment += 0.05;
      }
    });
    
    const adjustedObservedCount = Math.max(0, observedCount + adjustment * totalDraws); 

    probabilities[num] = (adjustedObservedCount + alpha) / (totalDraws + N * alpha);
    if(probabilities[num] < 0) probabilities[num] = 0; // Ensure non-negative
  }
  return probabilities;
}

// Génération de combinaison
function generateCombination(probabilities: { [key: number]: number }): number[] {
  const numbers = Object.keys(probabilities).map(Number).filter(n => n >= 1 && n <=90);
  
  // Éviter les combinaisons populaires (ex. suites, dates)
  const popularNumbers = [1, 2, 3, 4, 5, 7, 13, 15, 23, 27, 31]; // Example popular numbers
  const adjustedProbabilities = numbers.reduce((acc, num) => {
      acc[num] = popularNumbers.includes(num) ? (probabilities[num] || 0) * 0.8 : (probabilities[num] || 0);
      return acc;
  }, {} as {[key: number]: number });


  const validNumbersForCombination = Object.keys(adjustedProbabilities).map(Number);
  const validProbsForCombination = validNumbersForCombination.map(num => Math.max(0, adjustedProbabilities[num] || 0));

  const totalProbSum = validProbsForCombination.reduce((sum, p) => sum + p, 0);

  if (totalProbSum <= 0 || validNumbersForCombination.length < 5) {
    console.warn("Cannot generate combination: total probability sum is not positive or not enough numbers. Returning random set.");
    const set = new Set<number>();
    const availableForRandom = Array.from({length: 90}, (_, i) => i + 1);
    while(set.size < 5 && availableForRandom.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableForRandom.length);
        set.add(availableForRandom.splice(randomIndex, 1)[0]);
    }
    return Array.from(set).sort((a,b) => a-b);
  }

  const combination: number[] = [];
  const availableNumbers = [...validNumbersForCombination];
  const availableProbs = [...validProbsForCombination];

  while (combination.length < 5 && availableNumbers.length > 0) {
    const currentTotal = availableProbs.reduce((sum, w) => sum + w, 0);
    if (currentTotal <= 0) break; 

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
      availableNumbers.splice(chosenIndex, 1); 
      availableProbs.splice(chosenIndex, 1); 
    } else if (availableNumbers.length > 0) { // Fallback if random selection fails (should be rare with valid probs)
        let fallbackIndex = 0;
        if(availableProbs.length > 0) { // find index of max probability
            fallbackIndex = availableProbs.indexOf(Math.max(...availableProbs));
        }
        combination.push(availableNumbers[fallbackIndex]);
        availableNumbers.splice(fallbackIndex, 1);
        availableProbs.splice(fallbackIndex, 1);
    }
  }
  return combination.sort((a, b) => a - b);
}

const DB_NAME = 'LotoAnalyseDB'; // Updated DB Name
const DB_VERSION = 1;
const PREDICTIONS_STORE_NAME = 'predictions_v1'; // Versioned store name

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment.'));
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = event => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PREDICTIONS_STORE_NAME)) {
        const store = db.createObjectStore(PREDICTIONS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('drawNameDateIndex', ['draw_name', 'date'], { unique: false });
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


// Stockage des prédictions avec IndexedDB
export async function savePrediction(prediction: Omit<Prediction, 'id'>): Promise<number> {
 try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const addRequest = store.add(prediction);
      addRequest.onsuccess = () => resolve(addRequest.result as number); // ID of the added object
      addRequest.onerror = (event) => reject(new Error(`Failed to save prediction: ${(event.target as IDBRequest).error?.message}`));
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => reject(new Error(`Transaction error: ${(event.target as IDBTransaction).error?.message}`));
    });
  } catch (error) {
    console.warn(`Could not save prediction (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}`);
    throw error; // Re-throw if saving is critical, or handle differently
  }
}

export async function getPastPredictions(drawName?: string): Promise<Prediction[]> {
   try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const request = store.getAll(); 
      
      request.onsuccess = () => {
        let results = request.result as Prediction[];
        if (drawName && results) {
            results = results.filter(p => p.draw_name === drawName);
        }
        resolve(results || []);
      };
      request.onerror = (event) => {
        reject(new Error(`Failed to retrieve predictions: ${(event.target as IDBRequest).error?.message}`));
      };
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => reject(new Error(`Transaction error: ${(event.target as IDBTransaction).error?.message}`));
    });
  } catch (error) {
    console.warn(`Could not get past predictions (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}. Returning empty array.`);
    return []; 
  }
}

export async function updatePredictionActual(id: number, actual: number[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
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
      transaction.onerror = (event) => reject(new Error(`Transaction error during update: ${(event.target as IDBTransaction).error?.message}`));
    });
  } catch (error) {
     console.warn(`Could not update prediction (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}`);
     throw error; // Re-throw
  }
}


// Fonction principale pour générer une prédiction
export async function generatePrediction(drawName: string, month?: string): Promise<PredictionResult> {
  const draws = await fetchLotteryResults(month);
  const filteredDraws = draws.filter(draw => draw.draw_name === drawName);
  
  if (filteredDraws.length === 0) {
      // Return a structure indicating no data, or throw specific error
      console.warn(`No historical data found for draw '${drawName}' in the specified period.`);
      return {
          bayesianProbabilities: {},
          suggestedCombination: [],
          successivePairs: []
      };
  }

  const frequencies = analyzeFrequencies(filteredDraws);
  const successivePairs = analyzeSuccessivePairs(filteredDraws); // Already filters by same draw_name internally
  const pastPredictions = await getPastPredictions(drawName); 
  const bayesianProbabilitiesResult = bayesianProbabilities(frequencies, pastPredictions);
  const suggestedCombinationResult = generateCombination(bayesianProbabilitiesResult);

  return {
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination: suggestedCombinationResult,
    successivePairs: successivePairs,
  };
}

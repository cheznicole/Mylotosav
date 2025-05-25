
import axios, { type AxiosResponse } from 'axios';
import { parse } from 'date-fns';

// Interfaces
interface DrawSchedule {
  [day: string]: { [time: string]: string };
}

export interface DrawResult { // Exporting for use in components
  draw_name: string;
  date: string; // YYYY-MM-DD format
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
export const DRAW_SCHEDULE: DrawSchedule = {
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
  // The API seems to return current month data if no month param is specified.
  // If a specific month is needed, the format is "?month=MM-YYYY", e.g. "07-2024"
  // For now, let's assume the API gives a good range, or we fetch current month by default.
  // Example: `const currentMonthYear = format(new Date(), 'MM-yyyy');`
  // `const url = month ? `${baseUrl}?month=${month}` : `${baseUrl}?month=${currentMonthYear}`;
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
          
          // The API does not provide year. Assuming current year for now.
          // For more accuracy, this needs a robust way to determine year,
          // possibly by checking against current date or API providing year.
          const currentYear = new Date().getFullYear();
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
              machine: machineNumbers.length > 0 ? machineNumbers : undefined, // Machine numbers are 5 as per requirement, but API might vary.
            });
          }
        }
      }
    }

    if (results.length === 0) {
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
    // Do not throw error here for components to handle empty state or partial data
    // throw new Error('Échec de la récupération des résultats');
    return []; // Return empty array on error
  }
}

// Analyse fréquentielle (gagnants only for now)
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
        const predictedIncludesNum = pred.predicted.includes(num);
        const actualIncludesNum = pred.actual.includes(num);

        if (predictedIncludesNum && !actualIncludesNum) adjustment -= 0.05;
        else if (!predictedIncludesNum && actualIncludesNum) adjustment += 0.05;
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
  
  const validProbs = numbers.map(num => Math.max(0, probabilities[num] || 0));
  const totalProbSum = validProbs.reduce((sum, p) => sum + p, 0);

  if (totalProbSum <= 0 || numbers.length < 5) {
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
  const availableNumbers = [...numbers];
  const availableProbs = [...validProbs];

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
    } else if (availableNumbers.length > 0) {
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


const DB_NAME = 'MylotosavDB'; // Updated DB Name
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

export async function savePrediction(prediction: Prediction): Promise<void> {
 try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      const request = store.add(prediction);
      request.onsuccess = () => resolve();
      request.onerror = (event) => reject(new Error(`Failed to save prediction: ${(event.target as IDBRequest).error?.message}`));
      transaction.oncomplete = () => db.close();
      transaction.onerror = (event) => reject(new Error(`Transaction error: ${(event.target as IDBTransaction).error?.message}`));
    });
  } catch (error) {
    console.warn(`Could not save prediction (IndexedDB likely unavailable): ${error instanceof Error ? error.message : String(error)}`);
    // Don't rethrow, allow app to function without DB in non-browser envs
    return Promise.resolve();
  }
}

export async function getPastPredictions(drawName?: string): Promise<Prediction[]> {
   try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([PREDICTIONS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PREDICTIONS_STORE_NAME);
      let request: IDBRequest<Prediction[]>;

      if (drawName) {
        const index = store.index('drawNameDateIndex');
        // To get all for a drawName, we'd ideally use a range. 
        // For simplicity here, fetching all and filtering client-side if index use is complex.
        // Or, if an exact match on drawName is needed often, make 'draw_name' its own index.
        // For now, get all and filter.
        request = store.getAll(); 
      } else {
        request = store.getAll();
      }
      
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

// Analyse complète
export async function analyzeLotteryResults(drawNameFilter?: string, month?: string): Promise<AnalysisResult> {
  let draws = await fetchLotteryResults(month);
  if (drawNameFilter) {
      draws = draws.filter(d => d.draw_name === drawNameFilter);
  }
  const pastPredictions = await getPastPredictions(drawNameFilter); 
  
  const frequenciesData = analyzeFrequencies(draws);
  const coOccurrencesData = analyzeCoOccurrences(draws); // Can be filtered by targetNumber if needed later
  const successivePairsData = analyzeSuccessivePairs(draws); // Already filters by same draw_name internally
  const bayesianProbabilitiesResult = bayesianProbabilities(frequenciesData, pastPredictions);
  const suggestedCombinationResult = generateCombination(bayesianProbabilitiesResult);

  return {
    frequencies: frequenciesData,
    coOccurrences: coOccurrencesData,
    successivePairs: successivePairsData,
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination: suggestedCombinationResult,
  };
}



import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  orderBy,
  writeBatch,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebaseConfig'; // Ensure db is correctly imported
import type { PredictionResult as PredictionResultType, DrawResult as IDrawResult, Prediction as IPrediction } from '@/types';
import { getYear, parse as parseDateFns, isValid, format } from 'date-fns';
import axios, { type AxiosResponse } from 'axios'; // Added axios

// Re-export DRAW_SCHEDULE if it's defined here, or ensure it's imported if defined elsewhere
export const DRAW_SCHEDULE: { [day: string]: { [time: string]: string } }  = {
  Lundi: { '10H': 'Reveil', '13H': 'Etoile', '16H': 'Akwaba', '18H15': 'Monday Special' },
  Mardi: { '10H': 'La Matinale', '13H': 'Emergence', '16H': 'Sika', '18H15': 'Lucky Tuesday' },
  Mercredi: { '10H': 'Premiere Heure', '13H': 'Fortune', '16H': 'Baraka', '18H15': 'Midweek' },
  Jeudi: { '10H': 'Kado', '13H': 'Privilege', '16H': 'Monni', '18H15': 'Fortune Thursday' },
  Vendredi: { '10H': 'Cash', '13H': 'Solution', '16H': 'Wari', '18H15': 'Friday Bonanza' },
  Samedi: { '10H': 'Soutra', '13H': 'Diamant', '16H': 'Moaye', '18H15': 'National' },
  Dimanche: { '10H': 'Benediction', '13H': 'Prestige', '16H': 'Awale', '18H15': 'Espoir' },
};


// Use the IDrawResult for Firestore operations. Ensure it has an 'id' field.
export type DrawResult = IDrawResult; // This should have id: string
export type Prediction = IPrediction; // This should have id?: string


// Helper to compare if two number arrays are identical (order-independent)
const compareNumberArrays = (arr1?: number[], arr2?: number[]): boolean => {
  if (arr1 === undefined && arr2 === undefined) return true;
  if (arr1 === undefined || arr2 === undefined) return false;
  if (arr1.length === 0 && arr2.length === 0) return true; // Treat empty arrays as equal for machine numbers logic if one is undefined and other is empty
  if (arr1.length === 0 && arr2 !== undefined && arr2.length > 0) return false;
  if (arr2.length === 0 && arr1 !== undefined && arr1.length > 0) return false;
  if (arr1.length !== arr2.length) return false;

  const sorted1 = [...arr1].sort((a, b) => a - b).join(',');
  const sorted2 = [...arr2].sort((a, b) => a - b).join(',');
  return sorted1 === sorted2;
};

// Helper to check if two DrawResult objects are identical (excluding ID)
const areResultsIdentical = (res1: Omit<DrawResult, 'id'>, res2: Omit<DrawResult, 'id'>): boolean => {
  return res1.draw_name === res2.draw_name &&
         res1.date === res2.date && // Dates are expected to be in 'YYYY-MM-DD'
         compareNumberArrays(res1.gagnants, res2.gagnants) &&
         compareNumberArrays(res1.machine, res2.machine);
};


export async function fetchLotteryResults(drawName?: string): Promise<DrawResult[]> {
  try {
    const lotteryResultsCol = collection(db, 'lotteryResults');
    const q = query(
      lotteryResultsCol,
      ...(drawName ? [where('draw_name', '==', drawName)] : []),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DrawResult));
    return results;
  } catch (error) {
    console.error("Error fetching lottery results from Firestore:", error);
    throw new Error(`Failed to fetch lottery results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function addLotteryResult(newResultData: Omit<DrawResult, 'id'>): Promise<DrawResult> {
  try {
    const lotteryResultsCol = collection(db, 'lotteryResults');
    // Check for duplicates before adding
    const q = query(
      lotteryResultsCol,
      where('draw_name', '==', newResultData.draw_name),
      where('date', '==', newResultData.date)
    );
    const querySnapshot = await getDocs(q);
    let isDuplicate = false;
    querySnapshot.forEach((doc) => {
      if (areResultsIdentical(doc.data() as Omit<DrawResult, 'id'>, newResultData)) {
        isDuplicate = true;
      }
    });

    if (isDuplicate) {
      throw new Error("Duplicate result: This lottery result already exists.");
    }

    const docRef = await addDoc(lotteryResultsCol, newResultData);
    return { ...newResultData, id: docRef.id };
  } catch (error) {
    console.error("Error adding lottery result to Firestore:", error);
    throw new Error(`Failed to add lottery result: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function addMultipleDrawResults(
  newRawResults: Array<Omit<DrawResult, 'id'>>
): Promise<{ added: DrawResult[]; duplicates: number; errors: string[] }> {
  const addedResults: DrawResult[] = [];
  let duplicateCount = 0;
  const errorMessages: string[] = [];
  const lotteryResultsCol = collection(db, 'lotteryResults');

  for (const rawResult of newRawResults) {
    // Basic validation (more can be added if needed)
    if (!rawResult.gagnants || rawResult.gagnants.length !== 5 || !rawResult.gagnants.every(n => n >= 1 && n <= 90)) {
      const msg = `Skipped invalid result for ${rawResult.draw_name} on ${rawResult.date} due to 'gagnants' criteria.`;
      console.warn(msg, rawResult);
      errorMessages.push(msg);
      continue;
    }
     if (rawResult.machine && (!Array.isArray(rawResult.machine) || !rawResult.machine.every(n => n >= 1 && n <= 90))) {
      const msg = `Skipped invalid result for ${rawResult.draw_name} on ${rawResult.date} due to 'machine' criteria.`;
      console.warn(msg, rawResult);
      errorMessages.push(msg);
      continue;
    }


    try {
      // Check for duplicates before adding
      const q = query(
        lotteryResultsCol,
        where('draw_name', '==', rawResult.draw_name),
        where('date', '==', rawResult.date)
      );
      const querySnapshot = await getDocs(q);
      let isDuplicate = false;
      querySnapshot.forEach((doc) => {
        if (areResultsIdentical(doc.data() as Omit<DrawResult, 'id'>, rawResult)) {
          isDuplicate = true;
        }
      });

      if (isDuplicate) {
        duplicateCount++;
      } else {
        // Add the new result to Firestore
        const newResultRef = await addDoc(lotteryResultsCol, { ...rawResult }); // Spread to avoid modifying original rawResult if it's referenced elsewhere
        addedResults.push({ ...rawResult, id: newResultRef.id });
      }
    } catch (e) {
      const firestoreError = e instanceof Error ? e.message : String(e);
      console.error(`Firestore error processing result for draw ${rawResult.draw_name} on ${rawResult.date}: ${firestoreError}`, rawResult);
      errorMessages.push(`Failed to save ${rawResult.draw_name} (${rawResult.date}): ${firestoreError.substring(0, 100)}`);
    }
  }
  return { added: addedResults, duplicates: duplicateCount, errors: errorMessages };
}


export async function updateLotteryResult(updatedResult: DrawResult): Promise<DrawResult> {
  try {
    const resultDocRef = doc(db, 'lotteryResults', updatedResult.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...dataToUpdate } = updatedResult; // Firestore updates don't need the id in the data payload
    await updateDoc(resultDocRef, dataToUpdate);
    return updatedResult;
  } catch (error) {
    console.error("Error updating lottery result in Firestore:", error);
    throw new Error(`Failed to update lottery result: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function deleteLotteryResult(resultId: string): Promise<void> {
  try {
    const resultDocRef = doc(db, 'lotteryResults', resultId);
    await deleteDoc(resultDocRef);
  } catch (error) {
    console.error("Error deleting lottery result from Firestore:", error);
    throw new Error(`Failed to delete lottery result: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// For JSON Import: Replaces all data for the draw names present in the imported file.
export async function setAllLotteryResults(importedResults: DrawResult[]): Promise<{ importedCount: number; errorCount: number; errorDetails: string[]}> {
  
  let importedCount = 0;
  let errorCount = 0;
  const errorDetails: string[] = [];

  try {
    // Identify unique draw names from the import to clear only relevant existing data
    const uniqueDrawNamesToClear = [...new Set(importedResults.map(r => r.draw_name))];
    
    if (uniqueDrawNamesToClear.length > 0) {
      const deleteBatch = writeBatch(db);
      for (const drawName of uniqueDrawNamesToClear) {
        const q = query(collection(db, 'lotteryResults'), where('draw_name', '==', drawName));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => deleteBatch.delete(docSnap.ref));
      }
      await deleteBatch.commit();
      console.log(`Cleared existing Firestore data for draws: ${uniqueDrawNamesToClear.join(', ')}`);
    }
  } catch(e) {
     const firestoreError = e instanceof Error ? e.message : String(e);
     console.error("Error deleting old results during JSON import:", firestoreError);
     errorDetails.push(`Failed to clear old results: ${firestoreError}`);
     // Consider this a major error affecting the import's intention
     return { importedCount: 0, errorCount: importedResults.length, errorDetails };
  }
  
  // Using a new batch for additions
  const addBatch = writeBatch(db);
  for (const result of importedResults) {
    try {
        // Ensure IDs are not part of the data being written if Firestore generates them.
        // If results have IDs from export, they are document IDs for .set operation.
        const { id, ...dataToWrite } = result;
        const docRef = id ? doc(db, 'lotteryResults', id) : doc(collection(db, 'lotteryResults'));
        addBatch.set(docRef, dataToWrite); // Use set to handle cases where ID might be from export
        importedCount++;
    } catch (e) {
        const importError = e instanceof Error ? e.message : String(e);
        console.error(`Error preparing batch add for result: ${importError}`, result);
        errorDetails.push(`Error for ${result.draw_name} on ${result.date}: ${importError.substring(0,100)}`);
        errorCount++;
    }
  }

  try {
    await addBatch.commit();
  } catch(e) {
     const firestoreError = e instanceof Error ? e.message : String(e);
     console.error("Error committing batch add during JSON import:", firestoreError);
     errorDetails.push(`Batch import commit failed: ${firestoreError}`);
     // If batch commit fails, none of the items in this batch were successfully imported
     return { importedCount: 0, errorCount: importedResults.length, errorDetails };
  }

  return { importedCount, errorCount, errorDetails };
}


export async function getAllLotteryResultsForExport(): Promise<DrawResult[]> {
    return fetchLotteryResults(); // Simply fetch all results from Firestore
}

// --- Web Scraping from LotoBonheur.ci API ---
export async function scrapeAndParseLotteryResultsFromAPI(month?: string): Promise<Omit<DrawResult, 'id'>[]> {
  const baseUrl = 'https://lotobonheur.ci/api/results';
  // The API expects month in YYYY-MM format if provided
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    const response: AxiosResponse = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://lotobonheur.ci/resultats',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
      timeout: 15000, // Increased timeout
    });

    const resultsData = response.data;
    if (!resultsData || !resultsData.success) {
      console.error('API response not successful or data missing:', resultsData);
      throw new Error('API response not successful or data missing');
    }

    const drawsResultsWeekly = resultsData.drawsResultsWeekly;
    if (!Array.isArray(drawsResultsWeekly)) {
        console.error('drawsResultsWeekly is not an array:', drawsResultsWeekly);
        throw new Error('Invalid data structure: drawsResultsWeekly is not an array.');
    }
    
    const validDrawNames = new Set<string>();
    Object.values(DRAW_SCHEDULE).forEach(daySchedule => {
      Object.values(daySchedule).forEach(drawName => validDrawNames.add(drawName));
    });

    const parsedResults: Omit<DrawResult, 'id'>[] = [];
    const currentYear = getYear(new Date());

    for (const week of drawsResultsWeekly) {
      if (!week.drawResultsDaily || !Array.isArray(week.drawResultsDaily)) continue;

      for (const dailyResult of week.drawResultsDaily) {
        if (!dailyResult.date || !dailyResult.drawResults || !Array.isArray(dailyResult.drawResults.standardDraws)) continue;
        
        const dateStrApi = dailyResult.date; // e.g., "Jeu. 30/05"
        let drawDateFormatted: string;

        try {
          // Attempt to parse the date assuming format like "Day. DD/MM"
          const parts = dateStrApi.match(/(\d{1,2})\/(\d{1,2})/);
          if (parts && parts.length === 3) {
            const day = parts[1];
            const monthApi = parts[2];
            // The API seems to return current year's data by default. If a month param is used, it has YYYY-MM
            const yearToUse = month ? parseInt(month.split('-')[0], 10) : currentYear;
            const parsed = parseDateFns(`${day}/${monthApi}/${yearToUse}`, 'dd/MM/yyyy', new Date());
            if (isValid(parsed)) {
              drawDateFormatted = format(parsed, 'yyyy-MM-dd');
            } else {
              console.warn(`Invalid date parsed from API: ${dateStrApi} (day: ${day}, month: ${monthApi}, year: ${yearToUse})`);
              continue;
            }
          } else {
             console.warn(`Could not parse day/month from API date string: ${dateStrApi}`);
             continue;
          }
        } catch (e) {
          console.warn(`Error parsing date string from API: ${dateStrApi}`, e);
          continue;
        }

        for (const draw of dailyResult.drawResults.standardDraws) {
          const drawName = draw.drawName;
          // Skip if draw name is not in our schedule or if winning numbers are placeholder/invalid
          if (!validDrawNames.has(drawName) || (typeof draw.winningNumbers === 'string' && draw.winningNumbers.startsWith('.'))) {
            continue;
          }

          const winningNumbers = (typeof draw.winningNumbers === 'string' ? draw.winningNumbers.match(/\d+/g) || [] : []).map(Number).slice(0, 5);
          const machineNumbersStr = draw.machineNumbers;
          const machineNumbers = (typeof machineNumbersStr === 'string' ? machineNumbersStr.match(/\d+/g) || [] : []).map(Number).slice(0, 5);
          
          if (winningNumbers.length === 5) {
            parsedResults.push({
              draw_name: drawName,
              date: drawDateFormatted,
              gagnants: winningNumbers,
              machine: machineNumbers.length > 0 ? machineNumbers : undefined, // Store as undefined if empty
            });
          } else {
            // console.warn(`Incomplete winning numbers for draw ${drawName} on ${dateStrApi}: ${winningNumbers.join(',')}`);
          }
        }
      }
    }
    return parsedResults;
  } catch (error) {
    console.error(`Error fetching or parsing data from ${url}:`, error instanceof Error ? error.message : String(error));
    if (axios.isAxiosError(error) && error.response) {
      console.error("Axios error response:", error.response.data);
    }
    throw new Error(`Failed to fetch and parse lottery results from API: ${error instanceof Error ? error.message : String(error)}`);
  }
}


// Analyse fréquentielle - Exported for statistics page
export function analyzeFrequencies(draws: DrawResult[]): { [key: number]: number } {
  const allNumbers = draws.flatMap(draw => draw.gagnants);
  const frequency: { [key: number]: number } = {};
  for (let i = 1; i <= 90; i++) {
    frequency[i] = 0; // Initialize all numbers from 1 to 90
  }
  allNumbers.forEach(num => {
    if (num >=1 && num <= 90) { // Ensure number is within valid range
      frequency[num] = (frequency[num] || 0) + 1;
    }
  });
  return frequency;
}

// Analyse des tirages successifs
function analyzeSuccessivePairs(draws: DrawResult[]): Array<{ date1: string; date2: string; common_numbers: number[] }> {
  const pairs: Array<{ date1: string; date2: string; common_numbers: number[] }> = [];
  // Sort draws by date, then by draw_name to ensure correct succession within the same draw type
  const sortedDraws = [...draws].sort((a, b) => {
    const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
    if (dateComparison !== 0) return dateComparison;
    // If dates are same, sort by draw_name (though ideally, date + draw_name should be unique)
    return a.draw_name.localeCompare(b.draw_name);
  });

  for (let i = 0; i < sortedDraws.length - 1; i++) {
    // Only compare if it's the same draw_name for successive analysis
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
  const totalDraws = totalWinningNumbers > 0 ? Math.max(1, totalWinningNumbers / 5) : 0; // Each draw has 5 winning numbers
  const probabilities: { [key: number]: number } = {};
  const alpha = 1; // Laplace smoothing parameter (prior count for each number)
  const N = 90; // Total possible numbers

  for (let num = 1; num <= N; num++) {
    const observedCount = frequencies[num] || 0;
    let errorAdjustmentScore = 0; // Start with no adjustment

    // Incorporate learning from past prediction errors
    pastPredictions.forEach(pred => {
      if (pred.actual && pred.actual.length > 0) { // Ensure actual results are available
        const predictedThisNum = pred.predicted.includes(num);
        const actualThisNum = pred.actual.includes(num);

        if (predictedThisNum && !actualThisNum) errorAdjustmentScore -= 0.05; // Penalize if predicted but not actual
        if (!predictedThisNum && actualThisNum) errorAdjustmentScore += 0.05; // Reward if not predicted but was actual
      }
    });
    
    // The adjustment here aims to modify the "effective" observed count.
    // A simple way is to adjust the observedCount directly based on the score.
    // For example, if errorAdjustmentScore is +0.1, it's like saying the number appeared 10% more effectively than raw count.
    // This needs careful tuning. Let's apply adjustment to the observed count proportionally.
    const adjustedObservedCount = Math.max(0, observedCount + (observedCount * errorAdjustmentScore));


    // Bayesian probability with Laplace smoothing: (observed_count + alpha) / (total_draws + N * alpha)
    probabilities[num] = (adjustedObservedCount + alpha) / (totalDraws + N * alpha);
    if(probabilities[num] < 0) probabilities[num] = 0; // Ensure probability is not negative
  }
  return probabilities;
}

// Génération de combinaison
function generateCombination(probabilities: { [key: number]: number }): number[] {
  const numbers = Object.keys(probabilities).map(Number).filter(n => n >= 1 && n <=90); // Ensure we only consider valid lottery numbers
  
  // List of numbers considered "popular" or part of common patterns (e.g., sequences, birth dates)
  // This list can be tuned.
  const popularNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 28, 29, 30, 31];
  const probabilityReductionFactor = 0.8; // Reduce probability of popular numbers by 20%

  // Adjust probabilities: slightly reduce for popular numbers
  const adjustedProbabilitiesMap: {[key: number]: number } = {};
  numbers.forEach(num => {
      adjustedProbabilitiesMap[num] = Math.max(0, popularNumbers.includes(num) ? (probabilities[num] || 0) * probabilityReductionFactor : (probabilities[num] || 0));
  });
  
  // Prepare for weighted random selection
  let availableNumbers = Object.keys(adjustedProbabilitiesMap).map(Number);
  let availableProbs = availableNumbers.map(num => Math.max(0, adjustedProbabilitiesMap[num] || 0)); // Ensure non-negative

  const combination: number[] = [];

  // Handle cases where there are not enough unique numbers with positive probability
  if (availableNumbers.filter((_, i) => availableProbs[i] > 0).length < 5) {
    console.warn("Not enough unique numbers with positive probability for weighted selection. Filling randomly from available or all numbers.");
    const randomSet = new Set<number>();
    let sourceForRandomFill = availableNumbers.length > 0 ? [...availableNumbers] : Array.from({length: 90}, (_, i) => i + 1);
    
    // Add existing numbers with positive probability first if any
    availableNumbers.forEach((num, i) => {
        if (availableProbs[i] > 0 && !combination.includes(num) && combination.length < 5) {
            combination.push(num);
            randomSet.add(num);
        }
    });
    // Filter sourceForRandomFill to exclude already added numbers
    sourceForRandomFill = sourceForRandomFill.filter(n => !randomSet.has(n));

    while(combination.length < 5 && sourceForRandomFill.length > 0) {
        const randomIndex = Math.floor(Math.random() * sourceForRandomFill.length);
        const selectedNum = sourceForRandomFill.splice(randomIndex, 1)[0];
        combination.push(selectedNum);
        randomSet.add(selectedNum);
    }
     // If still not 5, fill with remaining numbers (this should not happen if sourceForRandomFill started with 90 numbers)
    let allLottoNumbers = Array.from({length: 90}, (_, i) => i + 1).filter(n => !randomSet.has(n));
    while(combination.length < 5 && allLottoNumbers.length > 0) {
        const randomIndex = Math.floor(Math.random() * allLottoNumbers.length);
        combination.push(allLottoNumbers.splice(randomIndex,1)[0]);
    }
    return combination.sort((a,b) => a-b);
  }


  for (let k=0; k<5; k++) {
    const currentTotalProbSum = availableProbs.reduce((sum, p) => sum + p, 0);

    // If all remaining probabilities are zero (or sum is too small), fill randomly from remaining available numbers
    if (currentTotalProbSum <= 1e-9) { // Use a small epsilon to handle floating point inaccuracies
        const remainingAvailableForFill = availableNumbers.filter(n => !combination.includes(n));
        while(combination.length < 5 && remainingAvailableForFill.length > 0) {
            const randIdx = Math.floor(Math.random() * remainingAvailableForFill.length);
            combination.push(remainingAvailableForFill.splice(randIdx, 1)[0]);
        }
        break; // Exit loop once filled
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
    
    // Fallback if chosenIndex remains -1 (shouldn't happen if currentTotalProbSum > 0 and probs are well-distributed)
    // Or if somehow chosenIndex is out of bounds (also shouldn't happen)
    if (chosenIndex === -1 || availableNumbers[chosenIndex] === undefined) {
        if (availableNumbers.length > 0) {
            // Pick a random available number as a fallback
            let fallbackIndex = Math.floor(Math.random() * availableNumbers.length);
            combination.push(availableNumbers[fallbackIndex]);
            availableNumbers.splice(fallbackIndex, 1);
            if (availableProbs.length > fallbackIndex) availableProbs.splice(fallbackIndex, 1);
        } else {
             // No more numbers to pick
            break;
        }
    } else {
        combination.push(availableNumbers[chosenIndex]);
        // Remove chosen number and its probability from further consideration
        availableNumbers.splice(chosenIndex, 1);
        availableProbs.splice(chosenIndex, 1);
    }
  }
  return combination.sort((a, b) => a - b);
}


// --- Firestore for Predictions ---
const PREDICTIONS_COLLECTION = 'predictions';

export async function savePrediction(predictionData: Omit<Prediction, 'id'>): Promise<Prediction> {
  try {
    const docRef = await addDoc(collection(db, PREDICTIONS_COLLECTION), predictionData);
    return { ...predictionData, id: docRef.id };
  } catch (error) {
    console.error("Error saving prediction to Firestore:", error);
    throw new Error(`Failed to save prediction: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function getPastPredictions(drawName?: string): Promise<Prediction[]> {
  try {
    const predictionsCol = collection(db, PREDICTIONS_COLLECTION);
    const q = query(
      predictionsCol,
      ...(drawName ? [where('draw_name', '==', drawName)] : []),
      orderBy('date', 'desc') // Assuming you want them sorted, typically by date
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Prediction));
  } catch (error) {
    console.error("Error fetching past predictions from Firestore:", error);
    throw new Error(`Failed to fetch past predictions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function updatePredictionActual(predictionId: string, actualResults: number[]): Promise<void> {
  try {
    const predictionDocRef = doc(db, PREDICTIONS_COLLECTION, predictionId);
    await updateDoc(predictionDocRef, { actual: actualResults });
  } catch (error) {
    console.error("Error updating prediction actual results in Firestore:", error);
    throw new Error(`Failed to update prediction actual results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function clearAllPredictions(): Promise<void> {
  try {
    const predictionsCol = collection(db, PREDICTIONS_COLLECTION);
    const snapshot = await getDocs(predictionsCol);
    const batch = writeBatch(db);
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
  } catch (error) {
    console.error("Error clearing all predictions from Firestore:", error);
    throw new Error(`Failed to clear all predictions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// --- Data Management for Settings Page ---
export async function clearAdminCache(): Promise<void> {
  // This function used to clear an in-memory cache.
  // With Firestore as the source of truth, direct cache clearing on the client/server that uses this API might not be applicable
  // unless this implies re-fetching from an external source or deleting specific admin-managed data in Firestore.
  // For now, this function will be a no-op, or could be repurposed.
  console.log("clearAdminCache called. With Firestore, data is fetched directly. This function might need redefinition based on specific cache clearing needs.");
  return Promise.resolve();
}

// Fonction principale pour générer une prédiction - Exported
export async function generatePrediction(drawName: string): Promise<PredictionResultType> {
  // Fetch results for the specific drawName from Firestore
  const draws = await fetchLotteryResults(drawName); 

  if (draws.length === 0) {
      console.warn(`No historical data found for draw '${drawName}' in Firestore to generate prediction.`);
      // Return a default or empty prediction result
      return {
          bayesianProbabilities: {},
          suggestedCombination: Array.from({length:5}, () => Math.floor(Math.random() * 90) + 1).sort((a,b)=>a-b), // Random if no data
          successivePairs: []
      };
  }

  const frequencies = analyzeFrequencies(draws);
  const successivePairs = analyzeSuccessivePairs(draws); // analyzeSuccessivePairs already filters by drawName internally due to sorting.
  const pastPredictions = await getPastPredictions(drawName); // Fetch past predictions for this specific drawName
  const bayesianProbabilitiesResult = bayesianProbabilities(frequencies, pastPredictions);
  const suggestedCombinationResult = generateCombination(bayesianProbabilitiesResult);

  return {
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination: suggestedCombinationResult,
    successivePairs: successivePairs,
  };
}

    
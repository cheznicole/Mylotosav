
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
import type { Prediction as IPrediction, NumberGap } from '@/types'; // Using Prediction from types for consistency
import { getYear, parse as parseDateFns, isValid, format } from 'date-fns';
import axios, { type AxiosResponse } from 'axios';

// Export DRAW_SCHEDULE as it's used by AppSidebar and other components
export const DRAW_SCHEDULE: { [day: string]: { [time: string]: string } } = {
  Lundi: { '10H': 'Reveil', '13H': 'Etoile', '16H': 'Akwaba', '18H15': 'Monday Special' },
  Mardi: { '10H': 'La Matinale', '13H': 'Emergence', '16H': 'Sika', '18H15': 'Lucky Tuesday' },
  Mercredi: { '10H': 'Premiere Heure', '13H': 'Fortune', '16H': 'Baraka', '18H15': 'Midweek' },
  Jeudi: { '10H': 'Kado', '13H': 'Privilege', '16H': 'Monni', '18H15': 'Fortune Thursday' },
  Vendredi: { '10H': 'Cash', '13H': 'Solution', '16H': 'Wari', '18H15': 'Friday Bonanza' },
  Samedi: { '10H': 'Soutra', '13H': 'Diamant', '16H': 'Moaye', '18H15': 'National' },
  Dimanche: { '10H': 'Benediction', '13H': 'Prestige', '16H': 'Awale', '18H15': 'Espoir' },
};

// Use the IDrawResult for Firestore operations. Ensure it has an 'id' field.
export interface DrawResult {
  id: string;
  draw_name: string;
  date: string; // Should be YYYY-MM-DD
  gagnants: number[];
  machine?: number[];
}
export type Prediction = IPrediction; // This should have id: string (optional when creating)

// Helper to compare if two number arrays are identical (order-independent)
const compareNumberArrays = (arr1?: number[], arr2?: number[]): boolean => {
  if (arr1 === undefined && arr2 === undefined) return true;
  if (arr1 === undefined || arr2 === undefined) {
    // Consider one undefined and other empty as equal for machine numbers
    if ((arr1 === undefined && arr2?.length === 0) || (arr2 === undefined && arr1?.length === 0)) {
        return true;
    }
    return false;
  }
  if (arr1.length === 0 && arr2.length === 0) return true;
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

export async function fetchLotteryResults(drawName?: string): Promise<DrawResult[]> {
  try {
    const lotteryResultsCol = collection(db, 'lotteryResults');
    const q = query(
      lotteryResultsCol,
      ...(drawName ? [where('draw_name', '==', drawName)] : []),
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as DrawResult));
    return results;
  } catch (error) {
    console.error("Error fetching lottery results from Firestore:", error);
    throw new Error(`Failed to fetch lottery results: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function addLotteryResult(newResultData: Omit<DrawResult, 'id'>): Promise<DrawResult> {
  try {
    const lotteryResultsCol = collection(db, 'lotteryResults');
    const q = query(
      lotteryResultsCol,
      where('draw_name', '==', newResultData.draw_name),
      where('date', '==', newResultData.date)
    );
    const querySnapshot = await getDocs(q);
    let isDuplicate = false;
    querySnapshot.forEach((docSnap) => {
      if (areResultsIdentical(docSnap.data() as Omit<DrawResult, 'id'>, newResultData)) {
        isDuplicate = true;
      }
    });

    if (isDuplicate) {
      throw new Error("Duplicate result: This lottery result already exists.");
    }
    
    const dataToSave: any = { ...newResultData };
    if (dataToSave.machine === undefined) {
        delete dataToSave.machine;
    }

    const docRef = await addDoc(lotteryResultsCol, dataToSave);
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
      const q = query(
        lotteryResultsCol,
        where('draw_name', '==', rawResult.draw_name),
        where('date', '==', rawResult.date)
      );
      const querySnapshot = await getDocs(q);
      let isDuplicate = false;
      querySnapshot.forEach((docSnap) => {
        if (areResultsIdentical(docSnap.data() as Omit<DrawResult, 'id'>, rawResult)) {
          isDuplicate = true;
        }
      });

      if (isDuplicate) {
        duplicateCount++;
      } else {
        const dataToSave: any = { ...rawResult };
        if (dataToSave.machine === undefined) {
            delete dataToSave.machine; // Remove machine field if it's undefined
        }
        const newResultRef = await addDoc(lotteryResultsCol, dataToSave);
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
    const { id, ...dataToUpdateAny } = updatedResult;
    const dataToUpdate = dataToUpdateAny as any; // Cast to any to allow potential deletion
    if (dataToUpdate.machine === undefined) {
        delete dataToUpdate.machine;
    }
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

export async function setAllLotteryResults(importedResults: DrawResult[]): Promise<{ importedCount: number; errorCount: number; errorDetails: string[]}> {
  let importedCount = 0;
  let errorCount = 0;
  const errorDetails: string[] = [];

  try {
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
     return { importedCount: 0, errorCount: importedResults.length, errorDetails };
  }
  
  const addBatch = writeBatch(db);
  for (const result of importedResults) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id, ...dataWithoutId } = result;
        const dataToSave: any = { ...dataWithoutId };
        if (dataToSave.machine === undefined) {
            delete dataToSave.machine;
        }
        const docRef = id ? doc(db, 'lotteryResults', id) : doc(collection(db, 'lotteryResults'));
        addBatch.set(docRef, dataToSave);
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
     return { importedCount: 0, errorCount: importedResults.length, errorDetails };
  }

  return { importedCount, errorCount, errorDetails };
}

export async function getAllLotteryResultsForExport(): Promise<DrawResult[]> {
    return fetchLotteryResults();
}

export async function scrapeAndParseLotteryResultsFromAPI(month?: string): Promise<Omit<DrawResult, 'id'>[]> {
  const baseUrl = 'https://lotobonheur.ci/api/results';
  const url = month ? `${baseUrl}?month=${month}` : baseUrl;

  try {
    const response: AxiosResponse = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://lotobonheur.ci/resultats',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
      },
      timeout: 15000,
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
    const defaultYear = getYear(new Date());

    for (const week of drawsResultsWeekly) {
      if (!week.drawResultsDaily || !Array.isArray(week.drawResultsDaily)) continue;

      for (const dailyResult of week.drawResultsDaily) {
        if (!dailyResult.date || !dailyResult.drawResults || !Array.isArray(dailyResult.drawResults.standardDraws)) continue;
        
        const dateStrApi = dailyResult.date;
        let drawDateFormatted: string;

        try {
          const parts = dateStrApi.match(/(\d{1,2})\/(\d{1,2})/);
          if (parts && parts.length === 3) {
            const day = parts[1];
            const monthApi = parts[2];
            const yearToUse = month ? parseInt(month.split('-')[0], 10) : defaultYear;
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
              machine: machineNumbers.length > 0 ? machineNumbers : undefined,
            });
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

export function analyzeGaps(draws: DrawResult[]): NumberGap[] {
  if (draws.length === 0) {
    return Array.from({ length: 90 }, (_, i) => ({ number: i + 1, gap: 0, lastSeenDate: null }));
  }

  // Sort draws from newest to oldest for easier gap calculation
  const sortedDraws = [...draws].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  const gaps: NumberGap[] = [];

  for (let num = 1; num <= 90; num++) {
    let gap = -1;
    let lastSeenDate: string | null = null;

    for (let i = 0; i < sortedDraws.length; i++) {
      const draw = sortedDraws[i];
      // Check both winning and machine numbers for appearance
      const allNumbersInDraw = [...draw.gagnants, ...(draw.machine || [])];
      if (allNumbersInDraw.includes(num)) {
        gap = i;
        lastSeenDate = draw.date;
        break; // Found the most recent appearance, stop searching for this number
      }
    }
    
    if (gap === -1) {
      // Number was never drawn in this specific set of results
      gaps.push({ number: num, gap: sortedDraws.length, lastSeenDate: null });
    } else {
      gaps.push({ number: num, gap, lastSeenDate });
    }
  }

  return gaps;
}


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
      if (pred.actual && pred.actual.length > 0) {
        const predictedThisNum = pred.predicted.includes(num);
        const actualThisNum = pred.actual.includes(num);
        if (predictedThisNum && !actualThisNum) errorAdjustmentScore -= 0.05;
        if (!predictedThisNum && actualThisNum) errorAdjustmentScore += 0.05;
      }
    });
    const adjustedObservedCount = Math.max(0, observedCount + (observedCount * errorAdjustmentScore));
    probabilities[num] = (adjustedObservedCount + alpha) / (totalDraws + N * alpha);
    if(probabilities[num] < 0) probabilities[num] = 0;
  }
  return probabilities;
}

function generateCombination(probabilities: { [key: number]: number }): number[] {
  const numbers = Object.keys(probabilities).map(Number).filter(n => n >= 1 && n <=90);
  const popularNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 23, 27, 28, 29, 30, 31];
  const probabilityReductionFactor = 0.8;
  const adjustedProbabilitiesMap: {[key: number]: number } = {};
  numbers.forEach(num => {
      adjustedProbabilitiesMap[num] = Math.max(0, popularNumbers.includes(num) ? (probabilities[num] || 0) * probabilityReductionFactor : (probabilities[num] || 0));
  });
  
  let availableNumbers = Object.keys(adjustedProbabilitiesMap).map(Number);
  let availableProbs = availableNumbers.map(num => Math.max(0, adjustedProbabilitiesMap[num] || 0));
  const combination: number[] = [];

  if (availableNumbers.filter((_, i) => availableProbs[i] > 0).length < 5) {
    console.warn("Not enough unique numbers with positive probability for weighted selection. Filling randomly.");
    const randomSet = new Set<number>();
    let sourceForRandomFill = availableNumbers.length > 0 ? [...availableNumbers] : Array.from({length: 90}, (_, i) => i + 1);
    availableNumbers.forEach((num, i) => {
        if (availableProbs[i] > 0 && !combination.includes(num) && combination.length < 5) {
            combination.push(num);
            randomSet.add(num);
        }
    });
    sourceForRandomFill = sourceForRandomFill.filter(n => !randomSet.has(n));
    while(combination.length < 5 && sourceForRandomFill.length > 0) {
        const randomIndex = Math.floor(Math.random() * sourceForRandomFill.length);
        const selectedNum = sourceForRandomFill.splice(randomIndex, 1)[0];
        combination.push(selectedNum);
        randomSet.add(selectedNum);
    }
    let allLottoNumbers = Array.from({length: 90}, (_, i) => i + 1).filter(n => !randomSet.has(n));
    while(combination.length < 5 && allLottoNumbers.length > 0) {
        const randomIndex = Math.floor(Math.random() * allLottoNumbers.length);
        combination.push(allLottoNumbers.splice(randomIndex,1)[0]);
    }
    return combination.sort((a,b) => a-b);
  }

  for (let k=0; k<5; k++) {
    const currentTotalProbSum = availableProbs.reduce((sum, p) => sum + p, 0);
    if (currentTotalProbSum <= 1e-9) {
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
    if (chosenIndex === -1 || availableNumbers[chosenIndex] === undefined) {
        if (availableNumbers.length > 0) {
            let fallbackIndex = Math.floor(Math.random() * availableNumbers.length);
            combination.push(availableNumbers[fallbackIndex]);
            if (availableProbs.length > fallbackIndex) availableProbs.splice(fallbackIndex, 1);
        } else {
            break;
        }
    } else {
        combination.push(availableNumbers[chosenIndex]);
        availableNumbers.splice(chosenIndex, 1);
        availableProbs.splice(chosenIndex, 1);
    }
  }
  return combination.sort((a, b) => a - b);
}

const PREDICTIONS_COLLECTION = 'predictions';

export async function savePrediction(predictionData: Omit<Prediction, 'id'>): Promise<Prediction> {
  try {
    const dataToSave: any = { ...predictionData };
    if (dataToSave.actual === undefined) { // Firestore does not support undefined
        delete dataToSave.actual;
    }
    const docRef = await addDoc(collection(db, PREDICTIONS_COLLECTION), dataToSave);
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
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Prediction));
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
    snapshot.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
  } catch (error) {
    console.error("Error clearing all predictions from Firestore:", error);
    throw new Error(`Failed to clear all predictions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function clearAdminCache(): Promise<void> {
  console.log("clearAdminCache called. With Firestore, data is fetched directly. This function might need redefinition.");
  return Promise.resolve();
}

// Import PredictionResult type from global types for consistency
import type { PredictionResult as PredictionResultType } from '@/types';

export async function generatePrediction(drawName: string): Promise<PredictionResultType> {
  const draws = await fetchLotteryResults(drawName); 
  if (draws.length === 0) {
      console.warn(`No historical data found for draw '${drawName}' in Firestore to generate prediction.`);
      return {
          bayesianProbabilities: {},
          suggestedCombination: Array.from({length:5}, () => Math.floor(Math.random() * 90) + 1).sort((a,b)=>a-b),
          successivePairs: []
      };
  }
  const frequencies = analyzeFrequencies(draws);
  const successivePairs = analyzeSuccessivePairs(draws);
  const pastPredictions = await getPastPredictions(drawName);
  const bayesianProbabilitiesResult = bayesianProbabilities(frequencies, pastPredictions);
  const suggestedCombinationResult = generateCombination(bayesianProbabilitiesResult);

  return {
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination: suggestedCombinationResult,
    successivePairs: successivePairs,
  };
}

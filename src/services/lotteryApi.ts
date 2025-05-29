
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
import { getYear, parse, isValid, format } from 'date-fns';


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
export type DrawResult = IDrawResult;
export type Prediction = IPrediction;


// Helper to compare if two number arrays are identical (order-independent)
const compareNumberArrays = (arr1?: number[], arr2?: number[]): boolean => {
  if (arr1 === undefined && arr2 === undefined) return true;
  if (arr1 === undefined || arr2 === undefined) return false;
  if (arr1.length === 0 && arr2.length === 0) return true; // Treat empty arrays as equal to undefined for machine numbers logic
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
    // Check for duplicates
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
      querySnapshot.forEach((doc) => {
        if (areResultsIdentical(doc.data() as Omit<DrawResult, 'id'>, rawResult)) {
          isDuplicate = true;
        }
      });

      if (isDuplicate) {
        duplicateCount++;
      } else {
        const newResultRef = await addDoc(lotteryResultsCol, { ...rawResult });
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

export async function setAllLotteryResults(importedResults: DrawResult[]): Promise<{ importedCount: number; errorCount: number; errorDetails: string[]}> {
  
  let importedCount = 0;
  let errorCount = 0;
  const errorDetails: string[] = [];

  try {
    // Delete existing results for the draw names being imported
    const uniqueDrawNames = [...new Set(importedResults.map(r => r.draw_name))];
    if (uniqueDrawNames.length > 0) {
      const deleteBatch = writeBatch(db);
      for (const drawName of uniqueDrawNames) {
        const q = query(collection(db, 'lotteryResults'), where('draw_name', '==', drawName));
        const snapshot = await getDocs(q);
        snapshot.forEach(docSnap => deleteBatch.delete(docSnap.ref));
      }
      await deleteBatch.commit();
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
    return fetchLotteryResults(); // Simply fetch all results
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

// Fonction principale pour générer une prédiction - Exported
export async function generatePrediction(drawName: string): Promise<PredictionResultType> {
  const draws = await fetchLotteryResults(drawName); // Fetch for specific draw name

  if (draws.length === 0) {
      console.warn(`No historical data found for draw '${drawName}' to generate prediction.`);
      return {
          bayesianProbabilities: {},
          suggestedCombination: [],
          successivePairs: []
      };
  }

  const frequencies = analyzeFrequencies(draws);
  const successivePairs = analyzeSuccessivePairs(draws); // This will use only draws for the specific drawName
  const pastPredictions = await getPastPredictions(drawName);
  const bayesianProbabilitiesResult = bayesianProbabilities(frequencies, pastPredictions);
  const suggestedCombinationResult = generateCombination(bayesianProbabilitiesResult);

  return {
    bayesianProbabilities: bayesianProbabilitiesResult,
    suggestedCombination: suggestedCombinationResult,
    successivePairs: successivePairs,
  };
}

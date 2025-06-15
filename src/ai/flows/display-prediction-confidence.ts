
'use server';
/**
 * @fileOverview AI agent to display confidence score or probability for each predicted lottery number with advanced Bayesian analysis.
 *
 * - displayPredictionConfidence - Calculates confidence scores for predicted numbers using historical data and temporal weighting.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Input schema with additional parameters for flexibility
const DisplayPredictionConfidenceInputSchema = z.object({
  predictedNumbers: z
    .array(z.number())
    .describe('An array of predicted lottery numbers.'),
  winningNumbersHistory: z
    .array(z.array(z.number()))
    .describe('History of winning lottery numbers as a 2D array.'),
  maxNumber: z
    .number()
    .describe('Maximum possible number in the lottery (e.g., 49 for 6/49).')
    .default(49),
  temporalWeights: z
    .array(z.number())
    .describe('Weights for historical draws based on recency.')
    .optional(),
});
type DisplayPredictionConfidenceInput = z.infer<
  typeof DisplayPredictionConfidenceInputSchema
>;

// Output schema
const DisplayPredictionConfidenceOutputSchema = z.object({
  confidenceScores: z
    .array(z.number())
    .describe('An array of confidence scores for each predicted number.'),
  error: z
    .string()
    .describe('Error message if input validation fails.')
    .optional(),
});
type DisplayPredictionConfidenceOutput = z.infer<
  typeof DisplayPredictionConfidenceOutputSchema
>;

// Main function
export async function displayPredictionConfidence(
  input: DisplayPredictionConfidenceInput
): Promise<DisplayPredictionConfidenceOutput> {
  // Input validation
  const { predictedNumbers, winningNumbersHistory, maxNumber } = input; // temporalWeights removed from direct destructuring here as it's handled in flow

  // Validate predicted numbers
  if (!predictedNumbers.every(num => num >= 1 && num <= maxNumber)) {
    return { confidenceScores: [], error: 'Predicted numbers must be between 1 and maxNumber.' };
  }

  // Validate winning numbers history
  if (winningNumbersHistory.length === 0) {
    return { confidenceScores: [], error: 'Winning numbers history is empty.' };
  }
  if (!winningNumbersHistory.every(draw => draw.every(num => num >= 1 && num <= maxNumber))) {
    return { confidenceScores: [], error: 'Invalid numbers in winning numbers history.' };
  }

  return displayPredictionConfidenceFlow(input);
}

// Prompt definition for AI integration
const displayPredictionConfidencePrompt = ai.definePrompt({
  name: 'displayPredictionConfidencePrompt',
  input: { schema: DisplayPredictionConfidenceInputSchema },
  output: { schema: DisplayPredictionConfidenceOutputSchema },
  prompt: `Given a list of predicted lottery numbers, the history of winning numbers, the maximum possible number, and optional temporal weights, calculate a confidence score for each predicted number using Bayesian analysis with temporal weighting.

Predicted Numbers: {{{predictedNumbers}}}
Winning Numbers History: {{{winningNumbersHistory}}}
Max Number: {{{maxNumber}}}
Temporal Weights: {{{temporalWeights}}}

Calculate confidence scores between 0 and 1 for each predicted number based on:
1. Frequency in historical data.
2. Temporal weighting (recent draws have higher weight if provided).
3. Bayesian smoothing to handle unseen numbers.

Return a JSON object: { confidenceScores: [number, number, ...] }. If an error occurs in calculation or input is invalid, return an error field in the JSON object.
`,
});

// Flow definition with advanced Bayesian analysis
const displayPredictionConfidenceFlow = ai.defineFlow(
  {
    name: 'displayPredictionConfidenceFlow',
    inputSchema: DisplayPredictionConfidenceInputSchema,
    outputSchema: DisplayPredictionConfidenceOutputSchema,
  },
  async input => {
    const { predictedNumbers, winningNumbersHistory, maxNumber, temporalWeights } = input;

    // Default temporal weights (equal weight if not provided, can be changed to exponential decay)
    const weights = temporalWeights && temporalWeights.length === winningNumbersHistory.length 
                    ? temporalWeights 
                    : Array(winningNumbersHistory.length).fill(1);
    
    if (weights.length !== winningNumbersHistory.length && temporalWeights) { // Check only if temporalWeights were provided but mismatched
      return { confidenceScores: [], error: 'Temporal weights length must match history length.' };
    }

    // Normalize weights
    const weightSum = weights.reduce((sum, w) => sum + w, 0);
    if (weightSum <= 0) { // Avoid division by zero if all weights are zero or negative
        return { confidenceScores: [], error: 'Sum of temporal weights must be positive.'};
    }
    const normalizedWeights = weights.map(w => w / weightSum);

    // Calculate frequency with temporal weighting
    const confidenceScores = predictedNumbers.map(predictedNumber => {
      let weightedFrequency = 0;
      winningNumbersHistory.forEach((winningNumbers, index) => {
        if (winningNumbers.includes(predictedNumber)) {
          weightedFrequency += normalizedWeights[index];
        }
      });

      // Advanced Bayesian smoothing (Dirichlet prior with alpha_0 = 1)
      // Each number gets a base pseudocount of alpha_k = alpha_0 / K, where K is maxNumber
      const alpha_k = 1 / maxNumber; 
      const smoothedFrequency = weightedFrequency + alpha_k;
      // The sum of all alpha_k is alpha_0. Total outcomes includes this sum.
      const smoothedTotalOutcomes = normalizedWeights.reduce((sum, w) => sum + w, 0) + 1; // sum of weights + sum of alphas (alpha_0)
      
      // Ensure smoothedTotalOutcomes is not zero to prevent division by zero
      if (smoothedTotalOutcomes <= 0) return 0; // Or handle error appropriately
      
      return smoothedFrequency / smoothedTotalOutcomes;
    });

    return { confidenceScores };
  }
);

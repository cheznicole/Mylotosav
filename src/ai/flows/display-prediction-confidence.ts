'use server';
/**
 * @fileOverview AI agent to display confidence score or probability for each predicted lottery number.
 *
 * - displayPredictionConfidence - A function that calculates the confidence score for each predicted number.
 * - DisplayPredictionConfidenceInput - The input type for the displayPredictionConfidence function.
 * - DisplayPredictionConfidenceOutput - The return type for the displayPredictionConfidence function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const DisplayPredictionConfidenceInputSchema = z.object({
  predictedNumbers: z
    .array(z.number())
    .describe('An array of predicted lottery numbers.'),
  winningNumbersHistory: z
    .array(z.array(z.number()))
    .describe('History of winning lottery numbers as a 2D array.'),
});
export type DisplayPredictionConfidenceInput = z.infer<
  typeof DisplayPredictionConfidenceInputSchema
>;

const DisplayPredictionConfidenceOutputSchema = z.object({
  confidenceScores: z
    .array(z.number())
    .describe('An array of confidence scores for each predicted number.'),
});
export type DisplayPredictionConfidenceOutput = z.infer<
  typeof DisplayPredictionConfidenceOutputSchema
>;

export async function displayPredictionConfidence(
  input: DisplayPredictionConfidenceInput
): Promise<DisplayPredictionConfidenceOutput> {
  return displayPredictionConfidenceFlow(input);
}

const displayPredictionConfidencePrompt = ai.definePrompt({
  name: 'displayPredictionConfidencePrompt',
  input: {schema: DisplayPredictionConfidenceInputSchema},
  output: {schema: DisplayPredictionConfidenceOutputSchema},
  prompt: `Given a list of predicted lottery numbers and the history of winning numbers, calculate a confidence score for each predicted number based on its frequency in the winning numbers history using Bayesian analysis.

Predicted Numbers: {{{predictedNumbers}}}
Winning Numbers History: {{{winningNumbersHistory}}}

Return an array of confidence scores between 0 and 1, corresponding to each predicted number. A higher score indicates a higher likelihood of the number being drawn, based on historical data.

Output should be a JSON object of the form { confidenceScores: [number, number, ...] }.
`,
});

const displayPredictionConfidenceFlow = ai.defineFlow(
  {
    name: 'displayPredictionConfidenceFlow',
    inputSchema: DisplayPredictionConfidenceInputSchema,
    outputSchema: DisplayPredictionConfidenceOutputSchema,
  },
  async input => {
    // Simple Bayesian analysis to calculate confidence scores
    const {predictedNumbers, winningNumbersHistory} = input;
    const confidenceScores = predictedNumbers.map(predictedNumber => {
      let frequency = 0;
      winningNumbersHistory.forEach(winningNumbers => {
        if (winningNumbers.includes(predictedNumber)) {
          frequency++;
        }
      });
      // Laplace smoothing to handle unseen numbers
      const smoothedFrequency = frequency + 1;
      const smoothedTotalOutcomes = winningNumbersHistory.length + 2;
      return smoothedFrequency / smoothedTotalOutcomes;
    });

    return {confidenceScores};
  }
);

'use server';
/**
 * @fileOverview Predicts lottery numbers based on a user-provided strategy.
 *
 * - predictLottoNumbersWithStrategy - A function that predicts lottery numbers based on a user-defined strategy.
 * - PredictLottoNumbersWithStrategyInput - The input type for the predictLottoNumbersWithStrategy function.
 * - PredictLottoNumbersWithStrategyOutput - The return type for the predictLottoNumbersWithStrategy function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictLottoNumbersWithStrategyInputSchema = z.object({
  strategyPrompt: z
    .string()
    .describe('A description of the lottery strategy to use when predicting numbers.'),
});
export type PredictLottoNumbersWithStrategyInput =
  z.infer<typeof PredictLottoNumbersWithStrategyInputSchema>;

const PredictLottoNumbersWithStrategyOutputSchema = z.object({
  predictedNumbers: z
    .array(z.number())
    .length(6)
    .describe('An array of 6 predicted lottery numbers based on the provided strategy.'),
  confidenceScores: z
    .array(z.number())
    .length(6)
    .describe('An array of confidence scores (0-1) for each predicted number.'),
});
export type PredictLottoNumbersWithStrategyOutput =
  z.infer<typeof PredictLottoNumbersWithStrategyOutputSchema>;

export async function predictLottoNumbersWithStrategy(
  input: PredictLottoNumbersWithStrategyInput
): Promise<PredictLottoNumbersWithStrategyOutput> {
  return predictLottoNumbersWithStrategyFlow(input);
}

const prompt = ai.definePrompt({
  name: 'predictLottoNumbersWithStrategyPrompt',
  input: {schema: PredictLottoNumbersWithStrategyInputSchema},
  output: {schema: PredictLottoNumbersWithStrategyOutputSchema},
  prompt: `You are an AI lottery number predictor.  Based on the strategy provided by the user, predict 6 lottery numbers, each between 1 and 49 (inclusive). Also, generate a confidence score between 0 and 1 for each predicted number.

  User Strategy: {{{strategyPrompt}}}

  Respond ONLY with a JSON object that conforms to the schema.  Do not include any other text.  The \"predictedNumbers\" field should be an array of 6 integers, and the \"confidenceScores\" field should be an array of 6 floating point numbers between 0 and 1.
`,
});

const predictLottoNumbersWithStrategyFlow = ai.defineFlow(
  {
    name: 'predictLottoNumbersWithStrategyFlow',
    inputSchema: PredictLottoNumbersWithStrategyInputSchema,
    outputSchema: PredictLottoNumbersWithStrategyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);

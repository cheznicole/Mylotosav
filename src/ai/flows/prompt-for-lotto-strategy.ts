
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
    .min(10, "Strategy description is too short.") // Added min length for better prompting
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
    .array(z.number().min(0).max(1)) // Ensure confidence scores are between 0 and 1
    .length(6)
    .describe('An array of confidence scores (0-1) for each predicted number.'),
  explanation: z
    .string()
    .optional()
    .describe('A brief explanation of how the AI applied the user\'s strategy to generate the numbers.'),
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
  prompt: `You are an AI lottery number predictor. Based on the strategy provided by the user, predict exactly 6 lottery numbers, each between 1 and 49 (inclusive). Also, generate a confidence score between 0 and 1 (inclusive) for each predicted number, where 1 is highest confidence.

User Strategy: {{{strategyPrompt}}}

Respond with a JSON object that conforms to the output schema.
The "predictedNumbers" field must be an array of 6 unique integers.
The "confidenceScores" field must be an array of 6 floating point numbers between 0 and 1.
The "explanation" field should briefly (1-2 sentences) describe how you interpreted and applied the user's strategy to arrive at the predicted numbers.
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
    if (!output) {
      throw new Error("AI failed to generate a strategy-based prediction. The output was null or undefined.");
    }
    // Zod schema validation handles length and types.
    // Could add an extra check for uniqueness of predictedNumbers if Zod doesn't cover it sufficiently.
    const uniquePredictedNumbers = [...new Set(output.predictedNumbers)];
    if (uniquePredictedNumbers.length !== 6) {
        throw new Error("AI predicted non-unique numbers or an incorrect count for strategy-based prediction. Expected 6 unique numbers.");
    }
    return output;
  }
);

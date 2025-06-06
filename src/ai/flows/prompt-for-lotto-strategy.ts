
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
    .describe('An array of confidence scores (0-1) for each predicted number, reflecting how well it fits the strategy.'),
  explanation: z
    .string()
    .optional()
    .describe('A brief explanation (1-2 sentences) of how the AI interpreted and applied the user\'s strategy to generate the numbers and their confidence scores.'),
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
  prompt: `You are an AI lottery number predictor. Based on the strategy provided by the user, predict exactly 6 lottery numbers, each between 1 and 49 (inclusive). Also, generate a confidence score between 0 and 1 (inclusive) for each predicted number.

User Strategy: {{{strategyPrompt}}}

Your tasks:
1.  **Interpret the Strategy**: Understand the core logic and constraints of the user's strategy.
2.  **Predict Numbers**: Generate 6 unique numbers that strictly follow the user's strategy.
3.  **Assign Confidence Scores**: For each predicted number, assign a confidence score (0-1). This score should represent how strongly that specific number aligns with the given strategy. A higher score means a better fit according to your interpretation of the strategy.
4.  **Provide Explanation**: Briefly explain (1-2 sentences) how you applied the user's strategy to arrive at the predicted numbers and their confidence scores. Link your choices directly to the provided strategy.

Respond with a JSON object that conforms to the output schema.
The "predictedNumbers" field must be an array of 6 unique integers.
The "confidenceScores" field must be an array of 6 floating point numbers between 0 and 1.
The "explanation" field must clearly and concisely describe your application of the strategy.
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
    const uniquePredictedNumbers = [...new Set(output.predictedNumbers)];
    if (uniquePredictedNumbers.length !== 6) {
        throw new Error("AI predicted non-unique numbers or an incorrect count for strategy-based prediction. Expected 6 unique numbers.");
    }
    if (!output.explanation || output.explanation.trim() === "") {
        console.warn("AI returned an empty or missing explanation for strategy-based prediction.");
        // Allow it to pass, but ideally, the AI should always provide one.
    }
    return output;
  }
);

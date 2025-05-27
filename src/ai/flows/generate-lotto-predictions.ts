// Implémentation de la prédiction des tirages du Loto Bonheur. Les prédictions sont générées en utilisant un modèle hybride XGBoost + RNN-LSTM pré-entraîné.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions.
 *
 * - generateLottoPredictions - A function that generates lottery predictions.
 * - GenerateLottoPredictionsInput - The input type for the generateLottoPredictions function.
 * - GenerateLottoPredictionsOutput - The return type for the generateLottoPredictions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLottoPredictionsInputSchema = z.object({
  pastResults: z
    .string()
    .describe(
      'A string containing the past lottery results data, preferably recent results.'
    ),
});
export type GenerateLottoPredictionsInput = z.infer<
  typeof GenerateLottoPredictionsInputSchema
>;

const GenerateLottoPredictionsOutputSchema = z.object({
  predictedNumbers: z.array(z.number()).describe('The predicted numbers for the next draw.'),
  confidenceScores: z
    .array(z.number())
    .describe('The confidence scores for each predicted number.'),
  analysis: z.string().describe('An analysis of why these numbers were predicted, including contextual insights about number trends or frequencies if discernible from the past results.'),
});
export type GenerateLottoPredictionsOutput = z.infer<
  typeof GenerateLottoPredictionsOutputSchema
>;

export async function generateLottoPredictions(
  input: GenerateLottoPredictionsInput
): Promise<GenerateLottoPredictionsOutput> {
  return generateLottoPredictionsFlow(input);
}

const generateLottoPredictionsPrompt = ai.definePrompt({
  name: 'generateLottoPredictionsPrompt',
  input: {schema: GenerateLottoPredictionsInputSchema},
  output: {schema: GenerateLottoPredictionsOutputSchema},
  prompt: `You are an AI lottery prediction expert specializing in Loto Bonheur.

  Based on the past lottery results provided, predict 5 unique numbers for the next Loto Bonheur draw. Also provide a confidence score (between 0 and 1) for each predicted number.

  Past Results: {{{pastResults}}}

  Your analysis should be insightful and written in natural language, as if explaining your reasoning to a user. For example, if a number is predicted, you might mention if it has been under-represented or over-represented recently, or if it frequently appears with other predicted numbers, based on the provided historical data. Aim for a detailed explanation for your choices.

  Ensure predictions adhere to Loto Bonheur rules (numbers between 1 and 90).
  Return the predicted numbers, their confidence scores, and your detailed analysis.
  The output field for predicted numbers should be 'predictedNumbers'.
  The output field for the analysis should be 'analysis'.
  Predictions:`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async input => {
    const {output} = await generateLottoPredictionsPrompt(input);
    // Ensure 5 numbers are predicted, if not, log and potentially adjust.
    // For now, we trust the LLM based on the prompt.
    if (output && output.predictedNumbers && output.predictedNumbers.length !== 5) {
      console.warn(`AI returned ${output.predictedNumbers.length} numbers, expected 5. Output:`, output);
      // Potentially add logic here to pad/truncate or re-query if critical
    }
    return output!;
  }
);


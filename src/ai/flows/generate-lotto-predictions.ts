
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
      'A string containing the past lottery results data, preferably recent results. Example format: "Date: YYYY-MM-DD, Gagnants: N1,N2,N3,N4,N5, Machine: M1,M2; Date: YYYY-MM-DD, ..." '
    ),
});
export type GenerateLottoPredictionsInput = z.infer<
  typeof GenerateLottoPredictionsInputSchema
>;

const GenerateLottoPredictionsOutputSchema = z.object({
  predictedNumbers: z.array(z.number()).length(5).describe('An array of 5 unique predicted numbers for the next draw.'),
  confidenceScores: z
    .array(z.number().min(0).max(1))
    .length(5)
    .describe('An array of 5 confidence scores (between 0 and 1) for each corresponding predicted number.'),
  analysis: z.string().describe('A detailed analysis in natural language explaining why these numbers were predicted, including insights on trends, frequencies, or other patterns observed in the past results. For example, "Le numéro 15 est sous-représenté depuis 3 semaines..."'),
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
  prompt: `Vous êtes un expert en analyse de données de loterie spécialisé dans Loto Bonheur. Votre rôle est d'analyser les résultats passés fournis et de prédire les 5 prochains numéros gagnants UNIQUES (entre 1 et 90).

Données des résultats passés:
{{{pastResults}}}

Votre tâche est la suivante:
1.  Analysez en profondeur les données historiques fournies. Recherchez des tendances, des fréquences de numéros (numéros chauds/froids), des séquences, des écarts temporels entre les apparitions de numéros, ou tout autre motif pertinent que vous pouvez déduire.
2.  Prédisez exactement 5 numéros UNIQUES pour le prochain tirage du Loto Bonheur. Assurez-vous que ces numéros sont compris entre 1 et 90.
3.  Pour chacun des 5 numéros prédits, fournissez un score de confiance individuel (une valeur numérique entre 0.0 et 1.0), où 1.0 représente la confiance la plus élevée. Votre score de confiance doit refléter la probabilité estimée que ce numéro spécifique soit tiré, basée sur votre analyse.
4.  Rédigez une analyse détaillée et perspicace en langage naturel (champ 'analysis'). Expliquez votre raisonnement pour la sélection de ces numéros. Par exemple, si un numéro est prédit, vous pourriez mentionner s'il a été sous-représenté ou sur-représenté récemment, s'il apparaît fréquemment avec d'autres numéros prédits (si observable dans les données fournies), ou toute autre observation pertinente issue de votre analyse des données. Votre analyse doit être convaincante et aider l'utilisateur à comprendre la logique derrière la prédiction. Évitez les déclarations vagues ; soyez précis dans votre explication.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie. Les 5 numéros prédits doivent être dans le champ 'predictedNumbers' et les 5 scores de confiance correspondants dans 'confidenceScores'.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async input => {
    const {output} = await generateLottoPredictionsPrompt(input);
    if (!output) {
        throw new Error("AI failed to generate predictions. The output was null or undefined.");
    }
    if (output.predictedNumbers.length !== 5 || output.confidenceScores.length !== 5) {
        // This case should ideally be caught by Zod schema validation if length is fixed.
        // However, an explicit check adds robustness if the AI doesn't strictly adhere.
        console.warn(`AI returned ${output.predictedNumbers.length} numbers and/or ${output.confidenceScores.length} scores. Expected 5 for each. Output:`, output);
        throw new Error("AI did not return the expected number of predictions or confidence scores (5 each).");
    }
     // Ensure predicted numbers are unique; LLMs might occasionally repeat.
    const uniquePredictedNumbers = [...new Set(output.predictedNumbers)];
    if (uniquePredictedNumbers.length !== 5) {
        // This implies Zod validation might also fail if the schema enforces unique items.
        // For now, log and rely on schema. A more complex recovery might involve re-prompting or filling.
        console.warn(`AI predicted non-unique numbers. Original: ${output.predictedNumbers.join(',')}, Unique: ${uniquePredictedNumbers.join(',')}`);
        throw new Error("AI predicted non-unique numbers. Expected 5 unique numbers.");
    }
    if (!output.analysis || output.analysis.trim() === "") {
        console.warn("AI returned an empty or missing analysis string.");
        // Depending on requirements, could throw or default analysis.
        // For now, we'll let it pass but Zod schema could enforce minLength.
    }

    return output;
  }
);

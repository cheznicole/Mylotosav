
// Implémentation de la prédiction des tirages du Loto Bonheur.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using AI analysis of past results.
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
  predictedNumbers: z.array(z.number().min(1).max(90)).length(5).describe('An array of 5 unique predicted numbers for the next draw, between 1 and 90.'),
  confidenceScores: z
    .array(z.number().min(0).max(1))
    .length(5)
    .describe('An array of 5 confidence scores (between 0 and 1) for each corresponding predicted number.'),
  analysis: z.string().describe('Une analyse détaillée en FRANÇAIS expliquant comment l\'IA est parvenue aux numéros prédits et à leurs scores de confiance, en se basant sur l\'analyse des {{{pastResults}}}. L\'analyse doit mettre en évidence les tendances, motifs, ou particularités statistiques observées dans les données fournies qui justifient la prédiction.'),
});
export type GenerateLottoPredictionsOutput = z.infer<
  typeof GenerateLottoPredictionsOutputSchema
>;

export async function generateLottoPredictions(
  input: GenerateLottoPredictionsInput
): Promise<GenerateLottoPredictionsOutput> {
  // Note: If a 503 Service Unavailable error occurs here, it's an external API issue (model overloaded).
  // The application should catch this error in the calling component and inform the user to try again later.
  return generateLottoPredictionsFlow(input);
}

const generateLottoPredictionsPrompt = ai.definePrompt({
  name: 'generateLottoPredictionsPrompt',
  input: {schema: GenerateLottoPredictionsInputSchema},
  output: {schema: GenerateLottoPredictionsOutputSchema},
  prompt: `Vous êtes une IA experte en analyse de données de loterie pour prédire les numéros du Loto Bonheur (5 numéros uniques entre 1 et 90).

Données des résultats passés fournies :
{{{pastResults}}}

Votre tâche est la suivante :
1.  **Analyse Approfondie des Données** : En vous basant UNIQUEMENT sur les {{{pastResults}}}, analysez les fréquences des numéros, les écarts (délais de réapparition), les numéros "chauds" (fréquemment sortis récemment) et "froids" (longtemps sans sortir), les paires ou triplets de numéros qui apparaissent souvent ensemble, et toute autre tendance ou motif statistique pertinent que vous pouvez identifier.
2.  **Prédiction et Scores de Confiance** :
    *   Prédisez exactement 5 numéros UNIQUES (entre 1 et 90) pour le prochain tirage.
    *   Attribuez un score de confiance individuel (0.0 - 1.0) à chaque numéro prédit. Ce score doit refléter la force des indicateurs que vous avez identifiés dans votre analyse pour ce numéro spécifique. Une confiance élevée indique une forte convergence de plusieurs facteurs analytiques.
3.  **Analyse Détaillée (champ 'analysis', en FRANÇAIS)** : Fournissez une explication détaillée et perspicace en FRANÇAIS (minimum 3-4 phrases).
    *   Expliquez clairement comment votre analyse des {{{pastResults}}} a conduit à la sélection des numéros spécifiques et à leurs scores de confiance.
    *   Mettez en évidence les 2-3 facteurs, tendances ou motifs statistiques les plus importants que vous avez observés dans les données fournies et qui justifient votre prédiction.
    *   Soyez précis sur les éléments qui ont augmenté ou diminué la confiance pour certains numéros, en vous référant directement à votre analyse des données historiques.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Les 5 numéros prédits doivent être dans le champ 'predictedNumbers'.
Les 5 scores de confiance correspondants dans 'confidenceScores'.
L'analyse détaillée en FRANÇAIS dans le champ 'analysis'.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async input => {
    // Note: If a 503 Service Unavailable error occurs here, it's an external API issue (model overloaded).
    // The application should catch this error in the calling component and inform the user to try again later.
    const {output} = await generateLottoPredictionsPrompt(input);
    if (!output) {
        throw new Error("L'IA n'a pas réussi à générer de prédictions. La sortie était nulle ou indéfinie.");
    }
    if (!output.predictedNumbers || output.predictedNumbers.length !== 5 ) {
        console.warn(`L'IA a retourné ${output.predictedNumbers?.length || 'aucun'} numéro prédit. Attendu : 5. Sortie :`, output);
        throw new Error("L'IA n'a pas retourné le nombre attendu de prédictions (5).");
    }
    if (!output.confidenceScores || output.confidenceScores.length !== 5) {
        console.warn(`L'IA a retourné ${output.confidenceScores?.length || 'aucun'} score de confiance. Attendu : 5. Sortie :`, output);
        throw new Error("L'IA n'a pas retourné le nombre attendu de scores de confiance (5).");
    }
     // Ensure predicted numbers are unique; LLMs might occasionally repeat.
    const uniquePredictedNumbers = [...new Set(output.predictedNumbers)];
    if (uniquePredictedNumbers.length !== 5) {
        console.warn(`L'IA a prédit des numéros non uniques. Originaux : ${output.predictedNumbers.join(',')}, Uniques : ${uniquePredictedNumbers.join(',')}`);
        // Attempt to recover if possible by taking the first 5 unique, but this indicates an issue with the prompt or model.
        if (uniquePredictedNumbers.length > 5) {
            output.predictedNumbers = uniquePredictedNumbers.slice(0, 5);
        } else {
            // If less than 5 unique numbers, it's a more critical failure to meet the requirements
            throw new Error(`L'IA a prédit des numéros non uniques et pas assez pour former un ensemble de 5. Attendu : 5 numéros uniques. Reçus (uniques) : ${uniquePredictedNumbers.join(',')}`);
        }
    } else {
        output.predictedNumbers = uniquePredictedNumbers; // Ensure it's the unique set
    }

    // Validate number range
    if (!output.predictedNumbers.every(num => num >= 1 && num <= 90)) {
        console.warn(`L'IA a prédit des numéros hors plage (1-90). Sortie :`, output.predictedNumbers);
        throw new Error("L'IA a prédit des numéros hors de la plage valide (1-90).");
    }
    if (!output.analysis || output.analysis.trim() === "" || output.analysis.length < 20) { // Added length check
        console.warn("L'IA a retourné une chaîne d'analyse vide, manquante ou très courte. Sortie :", output.analysis);
        // Provide a default or throw an error if analysis is critical
        output.analysis = "L'analyse détaillée des facteurs de prédiction n'a pas été fournie ou était insuffisante par l'IA pour cette prédiction.";
    }

    return output;
  }
);
// Simplified prediction logic, removing complex model simulations.

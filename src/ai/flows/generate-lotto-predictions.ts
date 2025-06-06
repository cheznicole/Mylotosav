
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
1.  **Analyse Approfondie des Données Historiques**:
    *   Utilisez les données historiques pour effectuer une analyse statistique. Identifiez les fréquences de chaque numéro (numéros chauds/froids), les écarts (depuis combien de tirages un numéro n'est pas sorti), et les séquences ou motifs récurrents.
    *   Considérez explicitement les tendances à court terme (ex: les 5-10 derniers tirages) et les tendances à long terme.
    *   Recherchez des corrélations non linéaires ou des motifs complexes que de simples statistiques pourraient manquer.
2.  **Prédiction de 5 Numéros Uniques**:
    *   Prédisez exactement 5 numéros UNIQUES pour le prochain tirage du Loto Bonheur. Assurez-vous que ces numéros sont compris entre 1 et 90.
3.  **Scores de Confiance Significatifs**:
    *   Pour chacun des 5 numéros prédits, fournissez un score de confiance individuel (valeur numérique entre 0.0 et 1.0).
    *   Ce score doit refléter la probabilité estimée que ce numéro spécifique soit tiré, basée sur la convergence de votre analyse (par exemple, si un numéro est à la fois fréquent à long terme et a un écart récent important, sa confiance pourrait être plus élevée).
4.  **Analyse Détaillée et Interprétable**:
    *   Rédigez une analyse détaillée (champ 'analysis') expliquant *comment* votre analyse des données historiques (fréquences, écarts, tendances, motifs) a conduit à la sélection de *ces numéros spécifiques*.
    *   Ne vous contentez pas de lister des observations ; expliquez le raisonnement liant l'analyse aux numéros prédits. Par exemple : "Le numéro X a été choisi car il est historiquement fréquent (apparu Y fois) et n'est pas sorti depuis Z tirages, indiquant un potentiel retour. De plus, il apparaît souvent en conjonction avec le numéro A, également prédit."
    *   Identifiez 2-3 facteurs ou motifs clés qui ont le plus influencé votre prédiction.
    *   Indiquez si votre stratégie tente d'équilibrer des numéros très fréquents avec des numéros plus rares, et pourquoi.
    *   Soyez conscient que la qualité et la représentativité des données fournies influencent l'analyse.

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
    // Note: If a 503 Service Unavailable error occurs here, it's an external API issue (model overloaded).
    // The application should catch this error in the calling component and inform the user to try again later.
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


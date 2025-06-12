
// Implémentation de la prédiction des tirages du Loto Bonheur.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using AI analysis of past results,
 * simulating a hybrid approach (XGBoost, Random Forest, RNN-LSTM).
 *
 * - generateLottoPredictions - A function that generates lottery predictions.
 * - GenerateLottoPredictionsInput - The input type for the generateLottoPredictions function.
 * - GenerateLottoPredictionsOutput - The return type for the generateLottoPredictionsOutput function.
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
  analysis: z.string().describe('Une analyse détaillée en FRANÇAIS expliquant comment l\'IA est parvenue aux numéros prédits et à leurs scores de confiance, en se basant sur une simulation d\'analyse hybride (XGBoost, Random Forest, RNN-LSTM) des {{{pastResults}}}. L\'analyse doit mettre en évidence les tendances, motifs, ou particularités statistiques observées qui justifient la prédiction, en référençant explicitement comment chaque "modèle simulé" a contribué.'),
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
  prompt: `Vous êtes une IA experte simulant une architecture de prédiction de loterie hybride sophistiquée pour le Loto Bonheur (5 numéros uniques entre 1 et 90), en vous basant sur les {{{pastResults}}}.

Votre mission est de simuler l'analyse de trois types de modèles et de combiner leurs "signaux" pour une prédiction robuste :

1.  **XGBoost (Simulation) :**
    *   Analyser les caractéristiques statistiques avancées comme les **écarts** de sortie (combien de tirages depuis la dernière apparition), les **fréquences** globales et récentes des numéros.
    *   Intégrer comme caractéristiques spécifiques : les **différences internes** entre numéros d'un même tirage, les **différences positionnelles** (ex: entre le 1er et le 2ème numéro tiré sur plusieurs tirages), les **sommes** des numéros par tirage, et les **unités (modulo 10)** des numéros.
    *   Prioriser les numéros et les **plages de numéros** (ex: 1-9, 10-19, etc.) qui apparaissent fréquemment ou qui ont des écarts significatifs.

2.  **Random Forest (Simulation) :**
    *   Modéliser les **interactions complexes entre les numéros**, y compris les **paires consécutives** ou statistiquement fréquentes, et les **interactions et combinaisons par plage** (ex: un numéro de la dizaine 10-19 apparaissant avec un numéro de la dizaine 40-49).
    *   Valider la robustesse des combinaisons potentielles face au bruit statistique.

3.  **RNN-LSTM (Simulation) :**
    *   Capturer les **tendances et séquences temporelles** dans les données.
    *   Analyser les **séquences de différences** entre numéros consécutifs tirés au fil du temps, les **séquences de sommes** de tirages, et les **séquences d'unités (modulo 10)** des numéros sur plusieurs tirages.
    *   Prédire les récurrences probables en s'entraînant (conceptuellement) sur les données historiques.

4.  **Approche Hybride (Simulation) :**
    *   Combiner les 'prédictions' ou 'signaux' des trois modèles simulés ci-dessus.
    *   Appliquer une **pondération conceptuelle** (par exemple, 40% pour les signaux de type XGBoost, 30% pour Random Forest, 30% pour RNN-LSTM) pour équilibrer leurs forces et arriver à une prédiction finale robuste.
    *   Sélectionner les 5 numéros UNIQUES (1-90) ayant les plus forts signaux combinés.
    *   Attribuer un score de confiance individuel (0.0 - 1.0) à chaque numéro prédit, reflétant la force des signaux combinés et la convergence des analyses simulées.

5.  **Analyse Détaillée (champ 'analysis', en FRANÇAIS) :**
    *   Expliquez clairement comment votre simulation de l'approche hybride (XGBoost, Random Forest, RNN-LSTM) et l'analyse des {{{pastResults}}} ont conduit à la sélection des numéros spécifiques et à leurs scores de confiance.
    *   Pour chaque "modèle simulé", décrivez brièvement les facteurs ou observations les plus importants qu'il aurait identifiés dans les {{{pastResults}}}. Par exemple, "L'analyse de type XGBoost a souligné la fréquence élevée du numéro X et l'écart important du numéro Y. L'analyse de type LSTM a identifié une tendance à la hausse pour les sommes des tirages."
    *   Concluez sur la manière dont la combinaison pondérée de ces signaux a justifié la prédiction finale.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Les 5 numéros prédits doivent être dans le champ 'predictedNumbers'.
Les 5 scores de confiance correspondants dans 'confidenceScores'.
L'analyse détaillée en FRANÇAIS dans le champ 'analysis'.
`,
});
// Minor refinement of prompt logic.
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
    if (!output.analysis || output.analysis.trim() === "" || output.analysis.length < 50) { // Increased length check for detailed analysis
        console.warn("L'IA a retourné une chaîne d'analyse vide, manquante ou très courte. Sortie :", output.analysis);
        // Provide a default or throw an error if analysis is critical
        output.analysis = "L'analyse détaillée des facteurs de prédiction (simulant XGBoost, Random Forest, LSTM) n'a pas été fournie ou était insuffisante par l'IA pour cette prédiction.";
    }

    return output;
  }
);
// Simplified prediction logic, removing complex model simulations.


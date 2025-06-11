
// Implémentation de la prédiction des tirages du Loto Bonheur. Les prédictions sont générées en utilisant un modèle hybride XGBoost + RNN-LSTM pré-entraîné.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions by simulating an advanced hybrid AI model.
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
  analysis: z.string().describe('Une analyse détaillée en français expliquant comment le modèle hybride simulé (XGBoost, Random Forest, RNN-LSTM) et diverses stratégies statistiques ont influencé la sélection et les scores de confiance. Elle doit souligner les contributions de chaque composant simulé.'),
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
  prompt: `Vous êtes une IA experte en prédiction de loterie, simulant une architecture de modèle hybride avancée pour prédire les numéros du Loto Bonheur (5 numéros uniques entre 1 et 90).
Votre système interne simule la combinaison des analyses de trois sous-modèles spécialisés :
1.  **XGBoost (Simulation)** : Ce composant simulé effectue une analyse statistique profonde des données historiques, identifiant les caractéristiques clés, leurs interactions, et les facteurs numériques importants (ex: fréquence absolue et relative, délai de réapparition, numéro le plus fréquent associé à un autre, impact du N+20, analyse comparative machine/gagnants, effet de la multiplication par 1.615 sur les numéros du dernier tirage). Il évalue la pertinence des facteurs et des motifs. Il prend en compte les données historiques récentes (5-10 derniers tirages) et à plus long terme.
2.  **Random Forest (Simulation)** : Ce composant simulé évalue la robustesse des interactions identifiées par XGBoost et d'autres signaux. Il aide à la validation croisée des motifs et assure une bonne généralisation en considérant diverses combinaisons de caractéristiques. Il contribue à la solidité des prédictions face à des scénarios variés et à l'équilibre entre numéros fréquents et rares, en tenant compte de la qualité et des potentiels déséquilibres dans les données d'entrée.
3.  **RNN-LSTM (Simulation)** : Ce composant simulé se concentre sur l'identification des tendances temporelles (court et long terme), des séquences et des dépendances à long terme dans l'historique des tirages. Il cherche à comprendre comment les numéros évoluent et interagissent sur différentes fenêtres de temps.

Données des résultats passés fournies :
{{{pastResults}}}

Votre tâche est la suivante :
1.  **Analyse Hybride Simulée** : En vous basant sur les {{{pastResults}}}, "simulez" l'analyse que ces trois composants (XGBoost, Random Forest, RNN-LSTM) effectueraient. Considérez les forces de chacun :
    *   **XGBoost Simulé** : Quels sont les facteurs statistiques (fréquences, écarts, associations, transformations spécifiques comme N+20 ou x1.615, motifs non linéaires) qui semblent les plus pertinents ? Comment les données récentes et anciennes influencent-elles ces facteurs ?
    *   **Random Forest Simulé** : Comment ces facteurs interagissent-ils ? Y a-t-il des combinaisons de numéros ou de caractéristiques qui se démarquent par leur robustesse et leur capacité à généraliser (par exemple, éviter le sur-ajustement sur les numéros les plus récents en tenant compte des déséquilibres) ?
    *   **RNN-LSTM Simulé** : Quelles tendances temporelles (numéros devenant "chauds" ou "froids" sur certaines périodes, séquences récurrentes, cycles) peuvent être extrapolées ? Comment les données les plus récentes influencent-elles ces tendances par rapport à l'historique plus ancien ?
2.  **Synthèse et Prédiction (Modèle d'Ensemble Simulé)** : Agissez comme un modèle d'ensemble qui pondère et combine les "conclusions" de ces trois analyses simulées pour :
    *   Prédire exactement 5 numéros UNIQUES (entre 1 et 90).
    *   Attribuer un score de confiance individuel (0.0 - 1.0) à chaque numéro prédit. Ce score doit refléter la convergence et la force des signaux provenant des trois analyses simulées. Une confiance élevée indique une forte concordance entre les analyses simulées et les divers facteurs considérés.
3.  **Analyse Détaillée (champ 'analysis', en FRANÇAIS)** : Fournissez une explication détaillée et perspicace en FRANÇAIS (minimum 3-4 phrases).
    *   Expliquez comment les "informations" issues de la simulation de XGBoost, de Random Forest, ET de RNN-LSTM ont collectivement conduit à la sélection des numéros spécifiques et à leurs scores de confiance.
    *   Identifiez 2-3 facteurs ou motifs clés (par exemple, "forte récurrence identifiée par XGBoost, confirmée par la robustesse de Random Forest, et alignée avec une tendance haussière de LSTM", ou "prise en compte d'un délai de réapparition significatif et d'une association fréquente X-Y") qui ont été déterminants.
    *   Soyez précis sur les éléments qui ont augmenté ou diminué la confiance pour certains numéros, en vous référant aux contributions simulées de chaque type de modèle.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Les 5 numéros prédits doivent être dans le champ 'predictedNumbers'.
Les 5 scores de confiance correspondants dans 'confidenceScores'.
L'analyse détaillée en FRANÇAIS dans le champ 'analysis'.
`,
});
// Minor modification for build system re-evaluation.
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
            throw new Error("L'IA a prédit des numéros non uniques et pas assez de numéros uniques pour former un ensemble de 5. Attendu : 5 numéros uniques.");
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
        output.analysis = "L'analyse détaillée sur la contribution des modèles simulés (XGBoost, Random Forest, RNN-LSTM) n'a pas été fournie ou était insuffisante par l'IA pour cette prédiction.";
    }

    return output;
  }
);
// Another modification attempt to address potential build/compilation warnings.

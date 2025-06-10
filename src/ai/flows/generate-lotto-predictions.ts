
// Implémentation de la prédiction des tirages du Loto Bonheur. Les prédictions sont générées en utilisant un modèle hybride XGBoost + RNN-LSTM pré-entraîné.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using a simulated Random Forest approach.
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
  analysis: z.string().describe('A detailed analysis in natural language explaining why these numbers were predicted. This explanation should detail how the simulated Random Forest approach and various statistical strategies influenced the selection and confidence scores.'),
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
  prompt: `Vous êtes une IA experte en analyse de données de loterie, simulant une approche de Forêt Aléatoire pour prédire les numéros du Loto Bonheur (5 numéros uniques entre 1 et 90).
Votre objectif est de générer 5 numéros prédits uniques, chacun avec un score de confiance, et une analyse détaillée de votre raisonnement.

Données des résultats passés fournies :
{{{pastResults}}}

Vous devez "simuler" le calcul et l'intégration des caractéristiques et stratégies suivantes pour chaque numéro potentiel (1 à 90) :

Stratégies de Prédiction à considérer :
1.  **Délai moyen avant réapparition** : Évaluez le nombre moyen de tirages avant qu'un numéro ne réapparaisse. Identifiez les numéros "en retard" par rapport à leur délai moyen.
2.  **Fréquence d'apparition** : Comptez la fréquence absolue et/ou relative de chaque numéro dans les tirages historiques fournis.
3.  **Numéro le plus fréquent associé** : Pour chaque numéro, identifiez le numéro qui apparaît le plus souvent dans le même tirage ou dans le tirage immédiatement précédent.
4.  **Numéro + 20** : Pour chaque numéro N, si N+20 <= 90, évaluez la fréquence historique de N+20.
5.  **Comparaison numéros machines/gagnants** : Si des numéros de machine sont présents dans les données, comparez leur fréquence d'apparition en tant que numéros machine par rapport à leur fréquence en tant que numéros gagnants.
6.  **Multiplication par 1,615** : Pour chaque numéro du DERNIER tirage fourni, multipliez-le par 1,615. Arrondissez à l'entier le plus proche. Si le résultat R est <= 90, évaluez la fréquence historique de R.

Mécanisme d'Apprentissage Simulé (Type Forêt Aléatoire) :
1.  **Calcul des Caractéristiques** : Pour chaque numéro de 1 à 90, "calculez" mentalement les valeurs des caractéristiques listées ci-dessus.
2.  **Évaluation Combinée** : Simulez comment une Forêt Aléatoire évaluerait ces caractéristiques. Pesez l'importance de chaque caractéristique. Par exemple, un numéro avec une haute fréquence, un retard significatif, et une forte association positive avec un autre numéro "chaud" pourrait recevoir un score plus élevé. La stratégie "Multiplication par 1,615" s'applique spécifiquement aux numéros issus du dernier tirage.
3.  **Score de Confiance Moyen** : Attribuez un score de confiance (entre 0.0 et 1.0) à chaque numéro potentiel, simulant le score moyen obtenu à partir de multiples "arbres de décision" virtuels qui auraient considéré ces caractéristiques. Un score de 1.0 signifie une confiance maximale.
4.  **Sélection Finale** : Sélectionnez les 5 numéros UNIQUES ayant les scores de confiance simulés les plus élevés.

Votre tâche est la suivante :
1.  **Analyse Approfondie** : Exécutez l'analyse ci-dessus sur les {{{pastResults}}}.
2.  **Prédiction de 5 Numéros Uniques** : Prédisez exactement 5 numéros uniques (entre 1 et 90).
3.  **Scores de Confiance Significatifs** : Pour chacun des 5 numéros prédits, fournissez un score de confiance individuel (0.0 - 1.0) basé sur votre simulation de Forêt Aléatoire.
4.  **Analyse Détaillée (champ 'analysis')** :
    *   Expliquez comment votre simulation de Forêt Aléatoire et la prise en compte des stratégies listées ont conduit à la sélection de *ces numéros spécifiques* et à leurs scores de confiance.
    *   Détaillez l'influence de quelques caractéristiques clés (par exemple, "Le numéro X a été choisi car il présentait un fort délai de réapparition et une fréquence élevée pour son dérivé par multiplication par 1,615").
    *   Soyez précis sur les facteurs qui ont augmenté ou diminué la confiance pour certains numéros.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Les 5 numéros prédits doivent être dans le champ 'predictedNumbers'.
Les 5 scores de confiance correspondants dans 'confidenceScores'.
L'analyse détaillée dans le champ 'analysis'.
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
    if (!output.predictedNumbers || output.predictedNumbers.length !== 5 ) {
        console.warn(`AI returned ${output.predictedNumbers?.length || 'no'} predicted numbers. Expected 5. Output:`, output);
        throw new Error("AI did not return the expected number of predictions (5).");
    }
    if (!output.confidenceScores || output.confidenceScores.length !== 5) {
        console.warn(`AI returned ${output.confidenceScores?.length || 'no'} confidence scores. Expected 5. Output:`, output);
        throw new Error("AI did not return the expected number of confidence scores (5).");
    }
     // Ensure predicted numbers are unique; LLMs might occasionally repeat.
    const uniquePredictedNumbers = [...new Set(output.predictedNumbers)];
    if (uniquePredictedNumbers.length !== 5) {
        console.warn(`AI predicted non-unique numbers. Original: ${output.predictedNumbers.join(',')}, Unique: ${uniquePredictedNumbers.join(',')}`);
        throw new Error("AI predicted non-unique numbers. Expected 5 unique numbers.");
    }
    // Validate number range
    if (!output.predictedNumbers.every(num => num >= 1 && num <= 90)) {
        console.warn(`AI predicted numbers out of range (1-90). Output:`, output.predictedNumbers);
        throw new Error("AI predicted numbers out of the valid range (1-90).");
    }
    if (!output.analysis || output.analysis.trim() === "") {
        console.warn("AI returned an empty or missing analysis string.");
        // Allow it to pass for now, but ideally, analysis should always be provided.
        output.analysis = "L'analyse détaillée n'a pas été fournie par l'IA pour cette prédiction.";
    }

    return output;
  }
);


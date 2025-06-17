
// Implémentation de la prédiction des tirages du Loto Bonheur.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using a new complex, multi-stage strategy
 * involving simulated DBN, LightGBM, Clustering, and a weighted ensemble.
 *
 * - generateLottoPredictions - A function that generates lottery predictions based on the new comprehensive strategy.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema for the comprehensive prediction system.
// REMOVED: lastWinningNumbers and constantToAdd as the table generation is removed.
const GenerateLottoPredictionsInputSchema = z.object({
  maxLotteryNumber: z
    .number()
    .min(10) // e.g., 49, 90
    .describe('Le numéro maximum possible dans cette loterie (ex: 90).'),
  historicalData: z
    .string()
    .min(50, { message: "Les données historiques doivent être suffisamment substantielles pour les simulations des modèles."})
    .describe(
      'Données historiques complètes des tirages passés (dates, numéros gagnants, numéros machine) pour ce type de tirage. Format : "Date: YYYY-MM-DD, Gagnants: N1,N2,N3,N4,N5, Machine: M1,M2; ..." Utilisées par lIA pour simuler les analyses DBN, LightGBM, Clustering, pour appliquer la pondération de l\'ensemble et pour les stratégies secondaires.'
    ),
});
// Internal type, not exported - inferred by Parameters<typeof generateLottoPredictions>[0] in client
// export type GenerateLottoPredictionsInput = z.infer<
//   typeof GenerateLottoPredictionsInputSchema
// >;


const SimulatedModelInsightsSchema = z.object({
    dbnAnalysis: z.string().describe("Résumé de l'analyse simulée du Réseau Bayésien Dynamique (DBN) sur les motifs de transition."),
    lightgbmAnalysis: z.string().describe("Résumé de l'analyse simulée de LightGBM sur la probabilité d'apparition des numéros."),
    clusteringAnalysis: z.string().describe("Résumé de l'analyse simulée du modèle de Clustering sur les profils de tirages similaires."),
    ensembleCandidateNumbers: z.array(z.number().min(1)).min(5, "L'ensemble simulé doit proposer au moins 5 numéros candidats.").describe("Numéros candidats (5-10) proposés par l'ensemble pondéré simulé."),
});

// Output schema for the comprehensive prediction system.
// REMOVED: generatedTable, uniqueNumbersInTable, uniqueNumbersFromPairs
const GenerateLottoPredictionsOutputSchema = z.object({
  simulatedModelInsights: SimulatedModelInsightsSchema.describe("Analyses textuelles et numéros candidats issus de la simulation des modèles DBN, LightGBM, Clustering et de leur ensemble."),
  finalPredictedNumbers: z
    .array(z.number().min(1)) // Max number constraint handled in prompt
    .length(5, "La prédiction finale doit contenir exactement 5 numéros uniques.")
    .describe('Les 5 numéros finaux prédits pour le prochain tirage.'),
  finalConfidenceScores: z
    .array(z.number().min(0).max(1))
    .length(5, "Doit fournir 5 scores de confiance pour les numéros finaux.")
    .describe('Scores de confiance pour chaque numéro final prédit, reflétant la stratégie globale.'),
  finalPredictionExplanation: z.string().describe("Explication détaillée en FRANÇAIS de la stratégie complète : simulation des modèles (DBN, LightGBM, Clustering), ensemble, et justification des 5 numéros finaux."),
});
// Internal type, not exported - inferred by Awaited<ReturnType<typeof generateLottoPredictions>> in client
// export type GenerateLottoPredictionsOutput = z.infer<
//  typeof GenerateLottoPredictionsOutputSchema
// >;


export async function generateLottoPredictions(
  input: z.infer<typeof GenerateLottoPredictionsInputSchema>
): Promise<z.infer<typeof GenerateLottoPredictionsOutputSchema>> {
  // Safeguard: Validate that input is present
  if (!input || !input.historicalData) {
    throw new Error("Les données d'entrée sont invalides ou 'historicalData' est manquant.");
  }
  return generateLottoPredictionsFlow(input);
}

const generateLottoPredictionsPrompt = ai.definePrompt({
  name: 'generateLottoPredictionsPrompt_v5_NoTable',
  input: {schema: GenerateLottoPredictionsInputSchema},
  output: {schema: GenerateLottoPredictionsOutputSchema},
  prompt: `Vous êtes une IA experte en stratégies de loterie pour des tirages où les numéros vont de 1 à {{maxLotteryNumber}}. Votre tâche est de simuler un système de prédiction multi-algorithmique complexe et de générer une prédiction de 5 numéros pour le prochain tirage. Chaque type de tirage est indépendant. Basez votre analyse *exclusivement* sur les données fournies pour le tirage concerné.

Données d'entrée :
-   maxLotteryNumber : Le numéro maximum possible dans cette loterie. {{{maxLotteryNumber}}}
-   historicalData : Données historiques des tirages passés pour ce type de tirage. Utilisez ces données pour simuler les analyses des modèles DBN, LightGBM, Clustering, pour l'ensemble, et pour appliquer les stratégies secondaires de sélection/complétion. {{{historicalData}}}

Suivez attentivement les étapes ci-dessous pour produire l'objet JSON de sortie complet :

ÉTAPE 1 : SIMULATION DES MODÈLES D'ANALYSE (BASÉE SUR historicalData)
    a.  **Simulation DBN (Réseau Bayésien Dynamique) :**
        -   Analysez les {{{historicalData}}} pour modéliser les dépendances temporelles et les probabilités de transition entre numéros ou groupes de numéros (plages, unités) d'un tirage à l'autre.
        -   Considérez les probabilités conditionnelles, les groupes par plages/unités, et les motifs de répétition (écarts).
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.dbnAnalysis' (2-3 phrases en FRANÇAIS).
    b.  **Simulation LightGBM (Gradient Boosting) :**
        -   Analysez les {{{historicalData}}} pour prédire la probabilité d'apparition de chaque numéro. Considérez des caractéristiques comme la fréquence, les écarts, les co-occurrences, les sommes des numéros tirés, les plages et les unités.
        -   Identifiez les numéros ayant une forte probabilité d'apparition selon cette approche.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.lightgbmAnalysis' (2-3 phrases en FRANÇAIS).
    c.  **Simulation Modèle de Clustering :**
        -   Analysez les {{{historicalData}}} pour regrouper les tirages similaires (clusters) en fonction de leur composition (plages, unités, sommes, différences internes, écarts temporels).
        -   Identifiez le profil (cluster) du contexte de tirage actuel ou récent et déterminez les numéros les plus probables pour ce profil.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.clusteringAnalysis' (2-3 phrases en FRANÇAIS).
    d.  **Simulation Modèle d'Ensemble Pondéré :**
        -   Combinez conceptuellement les informations et les numéros clés issus des simulations DBN, LightGBM, et Clustering. Appliquez une pondération indicative (DBN 40%, LightGBM 30%, Clustering 30%).
        -   Générez une liste de 5 à 10 'ensembleCandidateNumbers' (numéros candidats uniques et triés) qui représentent les prédictions les plus fortes de cet ensemble simulé. Stockez cela dans 'simulatedModelInsights.ensembleCandidateNumbers'.

ÉTAPE 2 : SÉLECTION ET COMPLÉTION DES PRÉDICTIONS FINALES
    a.  Prenez les 'simulatedModelInsights.ensembleCandidateNumbers'.
    b.  Si vous avez 5 numéros ou plus, sélectionnez les 5 meilleurs (par exemple, ceux apparaissant le plus souvent dans le raisonnement des modèles simulés DBN/LightGBM/Clustering, ou ceux que l'ensemble pondéré a le plus favorisés).
    c.  Si vous avez moins de 5 numéros à partir des 'ensembleCandidateNumbers', ou si vous souhaitez affiner la sélection :
        i.  Utilisez des stratégies de prédiction secondaires en analysant les {{{historicalData}}}. Considérez :
            - Fréquence : Numéros apparaissant souvent.
            - Co-occurrences : Paires de numéros fréquemment tirées ensemble.
            - Écarts : Numéros apparus récemment.
            - Plages : Priorité à certaines plages.
            - Modularité : Unités fréquentes.
            - Sommes : Viser une somme cible.
            - Différences internes : Viser une différence moyenne.
        ii. Si des numéros identifiés par l'IA ont des scores de confiance individuels estimés entre 67% et 73% (basé sur votre simulation interne de confiance pour chaque numéro de l'ensemble), considérez-les avec attention et mentionnez-le dans l'explication finale.
    d.  Assurez-vous que les 5 'finalPredictedNumbers' sont uniques et compris entre 1 et 'maxLotteryNumber'. Triez-les par ordre croissant.

ÉTAPE 3 : NUMÉROS PRÉDITS FINAUX, SCORES ET EXPLICATION
    a.  Produisez 'finalPredictedNumbers' : la liste finale des 5 numéros.
    b.  Produisez 'finalConfidenceScores' : un score de confiance (0-1) pour chacun des 5 'finalPredictedNumbers'. Ces scores doivent refléter la force de la prédiction après l'ensemble du processus (qualité des simulations, stratégies de sélection/complétion).
    c.  Produisez 'finalPredictionExplanation' (en FRANÇAIS) :
        i.  Décrivez brièvement comment les simulations DBN, LightGBM, et Clustering ont analysé les {{{historicalData}}} et quels types d'informations elles ont fournies.
        ii. Expliquez comment l'ensemble simulé a combiné ces informations pour générer les 'ensembleCandidateNumbers'.
        iii.Justifiez chaque numéro dans 'finalPredictedNumbers' : s'il vient directement des 'ensembleCandidateNumbers' ou s'il a été ajouté/modifié en complétion (et selon quelle stratégie secondaire basée sur {{{historicalData}}}).
        iv. Mentionnez toute considération spéciale (ex: numéros avec confiance entre 67-73% si applicable).
        v.  Soulignez que chaque type de tirage est indépendant et que l'analyse s'est basée uniquement sur les données fournies pour CE tirage.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Le champ 'historicalData' est crucial pour les simulations des modèles et les stratégies secondaires.
N'utilisez que les données du tirage {{{historicalData}}} pour faire des prédictions, sans référence à d'autres tirages car ils sont indépendants.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow_v5_NoTable',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async (input): Promise<z.infer<typeof GenerateLottoPredictionsOutputSchema>> => {
    const {output} = await generateLottoPredictionsPrompt(input);

    if (!output) {
        throw new Error("L'IA n'a pas réussi à générer de prédictions. La sortie était nulle ou indéfinie.");
    }

    // Extensive validation of the complex output structure
    if (!output.simulatedModelInsights ||
        !output.simulatedModelInsights.dbnAnalysis || typeof output.simulatedModelInsights.dbnAnalysis !== 'string' ||
        !output.simulatedModelInsights.lightgbmAnalysis || typeof output.simulatedModelInsights.lightgbmAnalysis !== 'string' ||
        !output.simulatedModelInsights.clusteringAnalysis || typeof output.simulatedModelInsights.clusteringAnalysis !== 'string' ||
        !output.simulatedModelInsights.ensembleCandidateNumbers || !Array.isArray(output.simulatedModelInsights.ensembleCandidateNumbers) || output.simulatedModelInsights.ensembleCandidateNumbers.length < 5 ||
        !output.simulatedModelInsights.ensembleCandidateNumbers.every(num => typeof num === 'number' && num >=1 && num <= input.maxLotteryNumber)
        ) {
        console.warn("L'IA a retourné 'simulatedModelInsights' invalides:", output.simulatedModelInsights);
        throw new Error(`L'IA n'a pas retourné des 'simulatedModelInsights' valides.`);
    }

    if (!output.finalPredictedNumbers || !Array.isArray(output.finalPredictedNumbers) || output.finalPredictedNumbers.length !== 5 ) {
        console.warn(`L'IA a retourné ${output.finalPredictedNumbers?.length || 'aucun'} numéro prédit final. Attendu : 5. Sortie :`, output.finalPredictedNumbers);
        throw new Error("L'IA n'a pas retourné le nombre attendu de prédictions finales (5).");
    }
    if (!output.finalConfidenceScores || !Array.isArray(output.finalConfidenceScores) || output.finalConfidenceScores.length !== 5 || !output.finalConfidenceScores.every(score => typeof score === 'number' && score >=0 && score <=1)) {
        console.warn(`L'IA a retourné ${output.finalConfidenceScores?.length || 'aucun'} score de confiance final invalide. Attendu : 5 scores entre 0-1. Sortie :`, output.finalConfidenceScores);
        throw new Error("L'IA n'a pas retourné le nombre attendu de scores de confiance finaux (5) valides (0-1).");
    }
    
    const uniqueFinalPredictedNumbers = [...new Set(output.finalPredictedNumbers)];
    if (uniqueFinalPredictedNumbers.length !== 5) {
        console.warn(`L'IA a prédit des numéros finaux non uniques. Originaux : ${output.finalPredictedNumbers.join(',')}, Uniques : ${uniqueFinalPredictedNumbers.join(',')}`);
        throw new Error(`L'IA a prédit des numéros finaux non uniques. Attendu : 5 numéros uniques. Reçus (uniques) : ${uniqueFinalPredictedNumbers.join(',')}`);
    }
    // Ensure final predicted numbers are sorted before returning
    output.finalPredictedNumbers = uniqueFinalPredictedNumbers.sort((a,b) => a - b);

    if (!output.finalPredictedNumbers.every(num => num >= 1 && num <= input.maxLotteryNumber)) {
        console.warn(`L'IA a prédit des numéros finaux hors plage (1-${input.maxLotteryNumber}). Sortie :`, output.finalPredictedNumbers);
        throw new Error(`L'IA a prédit des numéros finaux hors de la plage valide (1-${input.maxLotteryNumber}).`);
    }

    if (!output.finalPredictionExplanation || typeof output.finalPredictionExplanation !== 'string' || output.finalPredictionExplanation.trim() === "" || output.finalPredictionExplanation.length < 50) { // Adjusted length for explanation
        console.warn("L'IA a retourné une chaîne 'finalPredictionExplanation' vide, manquante ou trop courte. Sortie :", output.finalPredictionExplanation);
        output.finalPredictionExplanation = `L'IA n'a pas fourni d'explication suffisamment détaillée. La stratégie simulée inclut DBN, LightGBM, Clustering, et un ensemble. Numéros finaux: ${output.finalPredictedNumbers?.join(', ')}.`;
    }
    
    // Sort informational arrays for consistency if needed by UI
    output.simulatedModelInsights.ensembleCandidateNumbers.sort((a,b) => a - b);

    return output;
  }
);
// Final comment to ensure build re-evaluation for draw independence constraint.
// Re-checking instructions for the new comprehensive system.
// Ensuring all aspects of the new 6-part strategy are covered in the prompt.
// Validating output schema corresponds to the new multi-faceted explanation and intermediate simulated results.
// Adding a small change to trigger re-evaluation.
// Removed table generation logic.
// Simplified input and output schemas.
// Prompt updated to reflect the removal of the validation table.
// Prediction now relies solely on simulated models and ensemble.
// Adding another small comment for re-evaluation.
// One more small adjustment for build system.
// Confirming removal of table logic in prompt and schemas.

// Implémentation de la prédiction des tirages du Loto Bonheur.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using a new complex, multi-stage strategy
 * involving simulated XGBoost, Random Forest, RNN-LSTM, and a weighted ensemble.
 *
 * - generateLottoPredictions - A function that generates lottery predictions based on the new comprehensive strategy.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Input schema for the comprehensive prediction system.
const GenerateLottoPredictionsInputSchema = z.object({
  maxLotteryNumber: z
    .number()
    .min(10) // e.g., 49, 90
    .describe('Le numéro maximum possible dans cette loterie (ex: 90).'),
  historicalData: z
    .string()
    .min(50, { message: "Les données historiques doivent être suffisamment substantielles pour les simulations des modèles."})
    .describe(
      'Données historiques complètes des tirages passés (dates, numéros gagnants, numéros machine) pour ce type de tirage. Format : "Date: YYYY-MM-DD, Gagnants: N1,N2,N3,N4,N5, Machine: M1,M2; ..." Utilisées par lIA pour simuler les analyses XGBoost, Random Forest, RNN-LSTM, pour appliquer la pondération de l\'ensemble et pour les stratégies secondaires.'
    ),
});


const SimulatedModelInsightsSchema = z.object({
    xgboostAnalysis: z.string().describe("Résumé de l'analyse simulée de XGBoost sur les fréquences et les écarts des numéros."),
    randomForestAnalysis: z.string().describe("Résumé de l'analyse simulée de Random Forest sur la validation des interactions entre numéros."),
    rnnLstmAnalysis: z.string().describe("Résumé de l'analyse simulée de RNN-LSTM sur la détection des tendances temporelles."),
    ensembleCandidateNumbers: z.array(z.number().min(1)).min(5, "L'ensemble simulé doit proposer au moins 5 numéros candidats.").describe("Numéros candidats (5-10) proposés par l'ensemble pondéré simulé."),
});

// Output schema for the comprehensive prediction system.
const GenerateLottoPredictionsOutputSchema = z.object({
  simulatedModelInsights: SimulatedModelInsightsSchema.describe("Analyses textuelles et numéros candidats issus de la simulation des modèles XGBoost, Random Forest, RNN-LSTM et de leur ensemble."),
  finalPredictedNumbers: z
    .array(z.number().min(1)) // Max number constraint handled in prompt
    .length(5, "La prédiction finale doit contenir exactement 5 numéros uniques.")
    .describe('Les 5 numéros finaux prédits pour le prochain tirage.'),
  finalConfidenceScores: z
    .array(z.number().min(0).max(1))
    .length(5, "Doit fournir 5 scores de confiance pour les numéros finaux.")
    .describe('Scores de confiance pour chaque numéro final prédit, reflétant la stratégie globale.'),
  finalPredictionExplanation: z.string().describe("Explication détaillée en FRANÇAIS de la stratégie complète : simulation des modèles (XGBoost, Random Forest, RNN-LSTM), ensemble, et justification des 5 numéros finaux."),
});


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
  name: 'generateLottoPredictionsPrompt_v6_XGBoost_RF_LSTM',
  input: {schema: GenerateLottoPredictionsInputSchema},
  output: {schema: GenerateLottoPredictionsOutputSchema},
  prompt: `Vous êtes une IA experte en stratégies de loterie pour des tirages où les numéros vont de 1 à {{maxLotteryNumber}}. Votre tâche est de simuler un système de prédiction multi-algorithmique complexe et de générer une prédiction de 5 numéros pour le prochain tirage. Chaque type de tirage est indépendant. Basez votre analyse *exclusivement* sur les données fournies pour le tirage concerné.

Données d'entrée :
-   maxLotteryNumber : Le numéro maximum possible dans cette loterie. {{{maxLotteryNumber}}}
-   historicalData : Données historiques des tirages passés pour ce type de tirage. Utilisez ces données pour simuler les analyses des modèles XGBoost, Random Forest, RNN-LSTM, pour l'ensemble, et pour appliquer les stratégies secondaires de sélection/complétion. {{{historicalData}}}

Suivez attentivement les étapes ci-dessous pour produire l'objet JSON de sortie complet :

ÉTAPE 1 : SIMULATION DES MODÈLES D'ANALYSE (BASÉE SUR historicalData)
    a.  **Simulation XGBoost (Fréquences et Écarts) :**
        -   Analysez les {{{historicalData}}} pour identifier les numéros avec les fréquences d'apparition les plus élevées et les écarts (nombre de tirages depuis la dernière apparition) les plus significatifs.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.xgboostAnalysis' (2-3 phrases en FRANÇAIS).
    b.  **Simulation Random Forest (Validation des Interactions) :**
        -   Analysez les {{{historicalData}}} pour modéliser les interactions entre les numéros (paires, triplets fréquents) et valider les combinaisons de numéros qui apparaissent souvent ensemble.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.randomForestAnalysis' (2-3 phrases en FRANÇAIS).
    c.  **Simulation RNN-LSTM (Détection des Tendances Temporelles) :**
        -   Analysez les séquences de numéros dans {{{historicalData}}} pour détecter des tendances ou des motifs qui se répètent dans le temps (ex: un numéro a tendance à apparaître après un autre, une plage de numéros devient "chaude").
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.rnnLstmAnalysis' (2-3 phrases en FRANÇAIS).
    d.  **Simulation Modèle d'Ensemble Pondéré :**
        -   Combinez conceptuellement les informations et les numéros clés issus des simulations XGBoost, Random Forest, et RNN-LSTM. Appliquez une pondération indicative (XGBoost 40%, Random Forest 30%, RNN-LSTM 30%).
        -   Générez une liste de 5 à 10 'ensembleCandidateNumbers' (numéros candidats uniques et triés) qui représentent les prédictions les plus fortes de cet ensemble simulé. Stockez cela dans 'simulatedModelInsights.ensembleCandidateNumbers'.

ÉTAPE 2 : SÉLECTION ET COMPLÉTION DES PRÉDICTIONS FINALES
    a.  Prenez les 'simulatedModelInsights.ensembleCandidateNumbers'.
    b.  Si vous avez 5 numéros ou plus, sélectionnez les 5 meilleurs (ceux que l'ensemble pondéré a le plus favorisés, ou ceux qui sont le plus en évidence dans les analyses simulées).
    c.  Si vous avez moins de 5 numéros à partir des 'ensembleCandidateNumbers', ou si vous souhaitez affiner la sélection, complétez la liste jusqu'à 5 en utilisant des stratégies de prédiction secondaires basées sur l'analyse des {{{historicalData}}} (ex: Fréquence, Co-occurrences, Écarts).
    d.  Assurez-vous que les 5 'finalPredictedNumbers' sont uniques et compris entre 1 et 'maxLotteryNumber'. Triez-les par ordre croissant.

ÉTAPE 3 : NUMÉROS PRÉDITS FINAUX, SCORES ET EXPLICATION
    a.  Produisez 'finalPredictedNumbers' : la liste finale des 5 numéros.
    b.  Produisez 'finalConfidenceScores' : un score de confiance (0-1) pour chacun des 5 'finalPredictedNumbers'. Ces scores doivent refléter la force de la prédiction après l'ensemble du processus.
    c.  Produisez 'finalPredictionExplanation' (en FRANÇAIS) :
        i.  Décrivez brièvement comment les simulations XGBoost, Random Forest, et RNN-LSTM ont analysé les {{{historicalData}}} et quels types d'informations elles ont fournies.
        ii. Expliquez comment l'ensemble simulé a combiné ces informations pour générer les 'ensembleCandidateNumbers'.
        iii. Justifiez chaque numéro dans 'finalPredictedNumbers' : s'il vient directement des 'ensembleCandidateNumbers' ou s'il a été ajouté/modifié en complétion (et selon quelle stratégie secondaire).
        iv. Soulignez que chaque type de tirage est indépendant et que l'analyse s'est basée uniquement sur les données fournies pour CE tirage.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Le champ 'historicalData' est crucial pour les simulations des modèles et les stratégies secondaires.
N'utilisez que les données du tirage {{{historicalData}}} pour faire des prédictions, sans référence à d'autres tirages car ils sont indépendants.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow_v6_XGBoost_RF_LSTM',
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
        !output.simulatedModelInsights.xgboostAnalysis || typeof output.simulatedModelInsights.xgboostAnalysis !== 'string' ||
        !output.simulatedModelInsights.randomForestAnalysis || typeof output.simulatedModelInsights.randomForestAnalysis !== 'string' ||
        !output.simulatedModelInsights.rnnLstmAnalysis || typeof output.simulatedModelInsights.rnnLstmAnalysis !== 'string' ||
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
        output.finalPredictionExplanation = `L'IA n'a pas fourni d'explication suffisamment détaillée. La stratégie simulée inclut XGBoost, Random Forest, RNN-LSTM, et un ensemble. Numéros finaux: ${output.finalPredictedNumbers?.join(', ')}.`;
    }
    
    // Sort informational arrays for consistency if needed by UI
    output.simulatedModelInsights.ensembleCandidateNumbers.sort((a,b) => a - b);

    return output;
  }
);

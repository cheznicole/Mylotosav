'use server';
/**
 * @fileOverview Genkit flow to generate lottery predictions by simulating a new complex, multi-stage strategy
 * involving DBN, LightGBM, Clustering, and a weighted ensemble. This version strictly enforces the independence of each draw type.
 *
 * This file exports the following:
 * - generateLottoPredictions: An async function that generates lottery predictions based on the new comprehensive strategy.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

// Internal (not exported) schema for the comprehensive prediction system.
const GenerateLottoPredictionsInputSchema = z.object({
  maxLotteryNumber: z
    .number()
    .min(10) // e.g., 49, 90
    .describe('Le numéro maximum possible dans cette loterie (ex: 90).'),
  historicalData: z
    .string()
    .min(50, {
      message:
        'Les données historiques doivent être suffisamment substantielles pour la simulation des modèles.',
    })
    .describe(
      'Données historiques complètes des tirages passés pour ce type de tirage spécifique. Format : "Date: YYYY-MM-DD, Gagnants: N1,N2,N3,N4,N5, Machine: M1,M2; ..." Utilisées par lIA pour simuler les analyses DBN, LightGBM, Clustering, et pour appliquer la pondération de l\'ensemble et les stratégies secondaires.'
    ),
});

// Internal (not exported) schema for the simulated model insights.
const SimulatedModelInsightsSchema = z.object({
  dbnAnalysis: z
    .string()
    .describe(
      "Résumé de l'analyse simulée du Réseau Bayésien Dynamique (DBN) sur les motifs de transition et dépendances temporelles."
    ),
  lightgbmAnalysis: z
    .string()
    .describe(
      "Résumé de l'analyse simulée de LightGBM sur la probabilité d'apparition de chaque numéro."
    ),
  clusteringAnalysis: z
    .string()
    .describe(
      "Résumé de l'analyse simulée du Clustering pour identifier les profils de tirages similaires."
    ),
  ensembleCandidateNumbers: z
    .array(z.number().min(1))
    .min(5, "L'ensemble simulé doit proposer au moins 5 numéros candidats.")
    .describe(
      'Numéros candidats (5-10) proposés par le modèle d’ensemble pondéré simulé.'
    ),
});

// Internal (not exported) schema for the comprehensive prediction system output.
const GenerateLottoPredictionsOutputSchema = z.object({
  simulatedModelInsights: SimulatedModelInsightsSchema.describe(
    'Analyses textuelles et numéros candidats issus de la simulation des modèles DBN, LightGBM, Clustering et de leur ensemble.'
  ),
  finalPredictedNumbers: z
    .array(z.number().min(1))
    .length(5, 'La prédiction finale doit contenir exactement 5 numéros uniques.')
    .describe('Les 5 numéros finaux prédits pour le prochain tirage.'),
  finalConfidenceScores: z
    .array(z.number().min(0).max(1))
    .length(
      5,
      'Doit fournir 5 scores de confiance pour les numéros finaux.'
    )
    .describe(
      'Scores de confiance pour chaque numéro final prédit, reflétant la stratégie globale.'
    ),
  finalPredictionExplanation: z
    .string()
    .describe(
      'Explication détaillée en FRANÇAIS de la stratégie complète : simulation des modèles (DBN, LightGBM, Clustering), ensemble, et justification des 5 numéros finaux.'
    ),
});

export async function generateLottoPredictions(
  input: z.infer<typeof GenerateLottoPredictionsInputSchema>
): Promise<z.infer<typeof GenerateLottoPredictionsOutputSchema>> {
  if (!input || !input.historicalData) {
    throw new Error(
      "Les données d'entrée sont invalides ou 'historicalData' est manquant."
    );
  }
  return generateLottoPredictionsFlow(input);
}

const generateLottoPredictionsPrompt = ai.definePrompt({
  name: 'generateLottoPredictionsPrompt_v8_DBN_LGBM_Cluster',
  input: { schema: GenerateLottoPredictionsInputSchema },
  output: { schema: GenerateLottoPredictionsOutputSchema },
  prompt: `Vous êtes une IA experte en stratégies de loterie pour des tirages où les numéros vont de 1 à {{maxLotteryNumber}}.
IMPORTANT : Chaque type de tirage est **totalement indépendant**. Votre analyse doit se baser **exclusivement et uniquement** sur les historicalData fournies pour cette requête spécifique. **N'utilisez aucune information provenant d'autres types de tirages ou de prédictions que vous auriez pu faire précédemment.** Chaque prédiction est un nouveau contexte isolé.

Données d'entrée :
-   maxLotteryNumber : Le numéro maximum possible dans cette loterie. {{{maxLotteryNumber}}}
-   historicalData : Données historiques des tirages passés pour ce type de tirage. Utilisez ces données pour simuler les analyses des modèles. {{{historicalData}}}

Suivez attentivement les étapes ci-dessous pour produire l'objet JSON de sortie complet :

ÉTAPE 1 : SIMULATION DES MODÈLES D'ANALYSE (BASÉE SUR historicalData)
    a.  **Simulation Réseau Bayésien Dynamique (DBN) - Motifs de Transition :**
        -   Analysez les {{{historicalData}}} pour modéliser les dépendances temporelles et les probabilités de transition entre les numéros ou leurs caractéristiques (plages, unités) d'un tirage à l'autre.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.dbnAnalysis' (2-3 phrases en FRANÇAIS).
    b.  **Simulation LightGBM - Prédiction de Probabilité :**
        -   Analysez les {{{historicalData}}} (fréquences, écarts, co-occurrences, etc.) pour prédire la probabilité d'apparition de chaque numéro.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.lightgbmAnalysis' (2-3 phrases en FRANÇAIS).
    c.  **Simulation Clustering - Profils de Tirages :**
        -   Analysez les {{{historicalData}}} pour regrouper des tirages similaires en "clusters" basés sur leur composition (plages, sommes, etc.) et identifier des profils de tirages.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.clusteringAnalysis' (2-3 phrases en FRANÇAIS).
    d.  **Simulation Modèle d'Ensemble Pondéré :**
        -   Combinez conceptuellement les informations des simulations DBN, LightGBM, et Clustering. Appliquez une pondération indicative (DBN 40%, LightGBM 30%, Clustering 30%).
        -   Générez une liste de 5 à 10 'ensembleCandidateNumbers' (numéros candidats uniques et triés) qui représentent les prédictions les plus fortes de cet ensemble simulé. Stockez-les dans 'simulatedModelInsights.ensembleCandidateNumbers'.

ÉTAPE 2 : SÉLECTION ET COMPLÉTION DES PRÉDICTIONS FINALES
    a.  Prenez les 'simulatedModelInsights.ensembleCandidateNumbers'.
    b.  Si vous avez 5 numéros ou plus, sélectionnez les 5 meilleurs.
    c.  Si vous avez moins de 5 numéros, complétez la liste jusqu'à 5 en utilisant des stratégies de prédiction secondaires basées sur l'analyse des {{{historicalData}}} (ex: Fréquence, Co-occurrences, Écarts).
    d.  Assurez-vous que les 5 'finalPredictedNumbers' sont uniques et compris entre 1 et 'maxLotteryNumber'. Triez-les par ordre croissant.

ÉTAPE 3 : NUMÉROS PRÉDITS FINAUX, SCORES ET EXPLICATION
    a.  Produisez 'finalPredictedNumbers' : la liste finale des 5 numéros.
    b.  Produisez 'finalConfidenceScores' : un score de confiance (0-1) pour chacun des 5 'finalPredictedNumbers', reflétant la stratégie globale.
    c.  Produisez 'finalPredictionExplanation' (en FRANÇAIS) :
        i.  Décrivez brièvement comment les simulations DBN, LightGBM, et Clustering ont analysé les {{{historicalData}}}.
        ii. Expliquez comment l'ensemble simulé a combiné ces informations pour générer les 'ensembleCandidateNumbers'.
        iii. Justifiez chaque numéro dans 'finalPredictedNumbers'.
        iv. **Réaffirmez que votre analyse était strictement limitée aux données fournies pour ce tirage unique, car chaque type de tirage est indépendant.**

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow_v8_DBN_LGBM_Cluster',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async (
    input
  ): Promise<z.infer<typeof GenerateLottoPredictionsOutputSchema>> => {
    const { output } = await generateLottoPredictionsPrompt(input);

    if (!output) {
      throw new Error(
        "L'IA n'a pas réussi à générer de prédictions. La sortie était nulle ou indéfinie."
      );
    }

    // Extensive validation of the complex output structure
    if (
      !output.simulatedModelInsights ||
      !output.simulatedModelInsights.dbnAnalysis ||
      typeof output.simulatedModelInsights.dbnAnalysis !== 'string' ||
      !output.simulatedModelInsights.lightgbmAnalysis ||
      typeof output.simulatedModelInsights.lightgbmAnalysis !== 'string' ||
      !output.simulatedModelInsights.clusteringAnalysis ||
      typeof output.simulatedModelInsights.clusteringAnalysis !== 'string' ||
      !output.simulatedModelInsights.ensembleCandidateNumbers ||
      !Array.isArray(output.simulatedModelInsights.ensembleCandidateNumbers) ||
      output.simulatedModelInsights.ensembleCandidateNumbers.length < 5 ||
      !output.simulatedModelInsights.ensembleCandidateNumbers.every(
        (num) =>
          typeof num === 'number' &&
          num >= 1 &&
          num <= input.maxLotteryNumber
      )
    ) {
      console.warn(
        "L'IA a retourné 'simulatedModelInsights' invalides:",
        output.simulatedModelInsights
      );
      throw new Error(
        `L'IA n'a pas retourné des 'simulatedModelInsights' valides.`
      );
    }

    if (
      !output.finalPredictedNumbers ||
      !Array.isArray(output.finalPredictedNumbers) ||
      output.finalPredictedNumbers.length !== 5
    ) {
      console.warn(
        `L'IA a retourné ${
          output.finalPredictedNumbers?.length || 'aucun'
        } numéro prédit final. Attendu : 5. Sortie :`,
        output.finalPredictedNumbers
      );
      throw new Error(
        "L'IA n'a pas retourné le nombre attendu de prédictions finales (5)."
      );
    }
    if (
      !output.finalConfidenceScores ||
      !Array.isArray(output.finalConfidenceScores) ||
      output.finalConfidenceScores.length !== 5 ||
      !output.finalConfidenceScores.every(
        (score) => typeof score === 'number' && score >= 0 && score <= 1
      )
    ) {
      console.warn(
        `L'IA a retourné ${
          output.finalConfidenceScores?.length || 'aucun'
        } score de confiance final invalide. Attendu : 5 scores entre 0-1. Sortie :`,
        output.finalConfidenceScores
      );
      throw new Error(
        "L'IA n'a pas retourné le nombre attendu de scores de confiance finaux (5) valides (0-1)."
      );
    }

    const uniqueFinalPredictedNumbers = [...new Set(output.finalPredictedNumbers)];
    if (uniqueFinalPredictedNumbers.length !== 5) {
      console.warn(
        `L'IA a prédit des numéros finaux non uniques. Originaux : ${output.finalPredictedNumbers.join(
          ','
        )}, Uniques : ${uniqueFinalPredictedNumbers.join(',')}`
      );
      throw new Error(
        `L'IA a prédit des numéros finaux non uniques. Attendu : 5 numéros uniques. Reçus (uniques) : ${uniqueFinalPredictedNumbers.join(
          ','
        )}`
      );
    }
    // Ensure final predicted numbers are sorted before returning
    output.finalPredictedNumbers = uniqueFinalPredictedNumbers.sort(
      (a, b) => a - b
    );

    if (
      !output.finalPredictedNumbers.every(
        (num) => num >= 1 && num <= input.maxLotteryNumber
      )
    ) {
      console.warn(
        `L'IA a prédit des numéros finaux hors plage (1-${input.maxLotteryNumber}). Sortie :`,
        output.finalPredictedNumbers
      );
      throw new Error(
        `L'IA a prédit des numéros finaux hors de la plage valide (1-${input.maxLotteryNumber}).`
      );
    }

    if (
      !output.finalPredictionExplanation ||
      typeof output.finalPredictionExplanation !== 'string' ||
      output.finalPredictionExplanation.trim() === '' ||
      output.finalPredictionExplanation.length < 50
    ) {
      console.warn(
        "L'IA a retourné une chaîne 'finalPredictionExplanation' vide, manquante ou trop courte. Sortie :",
        output.finalPredictionExplanation
      );
      output.finalPredictionExplanation = `L'IA n'a pas fourni d'explication suffisamment détaillée. La stratégie simulée inclut DBN, LightGBM, et Clustering. Numéros finaux: ${output.finalPredictedNumbers?.join(
        ', '
      )}.`;
    }

    // Sort informational arrays for consistency if needed by UI
    output.simulatedModelInsights.ensembleCandidateNumbers.sort(
      (a, b) => a - b
    );

    return output;
  }
);
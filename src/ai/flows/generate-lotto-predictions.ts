
// Implémentation de la prédiction des tirages du Loto Bonheur.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using a new complex, multi-stage strategy
 * involving simulated DBN, LightGBM, Clustering, a weighted ensemble, and a validation table.
 *
 * - generateLottoPredictions - A function that generates lottery predictions based on the new comprehensive strategy.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateLottoPredictionsInputSchema = z.object({
  lastWinningNumbers: z
    .array(z.number().min(1))
    .length(5, { message: "Doit fournir exactement 5 numéros du dernier tirage pour le tableau de validation."})
    .describe('Les 5 numéros gagnants du dernier tirage, utilisés pour générer le tableau de validation.'),
  constantToAdd: z
    .number()
    .min(1)
    .describe('La constante à ajouter pour la génération du tableau de validation.'),
  maxLotteryNumber: z
    .number()
    .min(10) // e.g., 49, 90
    .describe('Le numéro maximum possible dans cette loterie (ex: 90).'),
  historicalData: z
    .string()
    .min(50, { message: "Les données historiques doivent être suffisamment substantielles pour les simulations des modèles."})
    .describe(
      'Données historiques complètes des tirages passés (dates, numéros gagnants, numéros machine) pour ce type de tirage. Utilisées par lIA pour simuler les analyses DBN, LightGBM, Clustering et pour appliquer les stratégies secondaires. Format : "Date: YYYY-MM-DD, Gagnants: N1,N2,N3,N4,N5, Machine: M1,M2; ..."'
    ),
});
// Internal type, not exported
type GenerateLottoPredictionsInput = z.infer<
  typeof GenerateLottoPredictionsInputSchema
>;

const SimulatedModelInsightsSchema = z.object({
    dbnAnalysis: z.string().describe("Résumé de l'analyse simulée du Réseau Bayésien Dynamique (DBN) sur les motifs de transition."),
    lightgbmAnalysis: z.string().describe("Résumé de l'analyse simulée de LightGBM sur la probabilité d'apparition des numéros."),
    clusteringAnalysis: z.string().describe("Résumé de l'analyse simulée du modèle de Clustering sur les profils de tirages similaires."),
    ensembleCandidateNumbers: z.array(z.number().min(1)).min(5, "L'ensemble simulé doit proposer au moins 5 numéros candidats.").describe("Numéros candidats (5-10) proposés par l'ensemble pondéré simulé, avant filtrage par le tableau."),
});

const GenerateLottoPredictionsOutputSchema = z.object({
  generatedTable: z
    .array(z.array(z.number().min(1)).length(5, "Chaque ligne du tableau de validation doit contenir 5 numéros."))
    .length(5, "Le tableau de validation généré doit contenir 5 lignes.")
    .describe("Le tableau de validation 5x5 généré."),
  uniqueNumbersInTable: z.array(z.number().min(1)).describe("Liste des numéros uniques présents dans le tableau de validation généré."),
  uniqueNumbersFromPairs: z.array(z.number().min(1)).describe("Liste informationnelle des numéros uniques (1-{{maxLotteryNumber}}) formés à partir des paires de chiffres extraites du tableau de validation."),
  simulatedModelInsights: SimulatedModelInsightsSchema.describe("Analyses textuelles et numéros candidats issus de la simulation des modèles DBN, LightGBM, Clustering et de leur ensemble."),
  finalPredictedNumbers: z
    .array(z.number().min(1)) // Max number constraint handled in prompt
    .length(5, "La prédiction finale doit contenir exactement 5 numéros uniques.")
    .describe('Les 5 numéros finaux prédits pour le prochain tirage, après filtrage par le tableau et complétion.'),
  finalConfidenceScores: z
    .array(z.number().min(0).max(1))
    .length(5, "Doit fournir 5 scores de confiance pour les numéros finaux.")
    .describe('Scores de confiance pour chaque numéro final prédit, reflétant la stratégie globale.'),
  finalPredictionExplanation: z.string().describe("Explication détaillée en FRANÇAIS de la stratégie complète : simulation des modèles (DBN, LightGBM, Clustering), ensemble, génération du tableau, filtrage, et justification des 5 numéros finaux."),
});
// Internal type, not exported
type GenerateLottoPredictionsOutput = z.infer<
  typeof GenerateLottoPredictionsOutputSchema
>;

export async function generateLottoPredictions(
  input: GenerateLottoPredictionsInput
): Promise<GenerateLottoPredictionsOutput> {
  // Safeguard: Validate that input and lastWinningNumbers are present
  if (!input || !input.lastWinningNumbers) {
    throw new Error("Les données d'entrée sont invalides ou 'lastWinningNumbers' est manquant.");
  }
  // Validate that numbers in lastWinningNumbers are within maxLotteryNumber
  if (input.lastWinningNumbers.some(n => n > input.maxLotteryNumber || n < 1)) {
    throw new Error(`Certains numéros pour le tableau de validation sont invalides (hors plage 1-${input.maxLotteryNumber}).`);
  }
  return generateLottoPredictionsFlow(input);
}

const generateLottoPredictionsPrompt = ai.definePrompt({
  name: 'generateLottoPredictionsPrompt_v4_ComprehensiveSystem',
  input: {schema: GenerateLottoPredictionsInputSchema},
  output: {schema: GenerateLottoPredictionsOutputSchema},
  prompt: `Vous êtes une IA experte en stratégies de loterie pour des tirages où les numéros vont de 1 à {{maxLotteryNumber}}. Votre tâche est de simuler un système de prédiction multi-algorithmique complexe et de générer une prédiction de 5 numéros pour le prochain tirage. Chaque type de tirage est indépendant. Basez votre analyse *exclusivement* sur les données fournies pour le tirage concerné.

Données d'entrée :
-   lastWinningNumbers : Les 5 numéros gagnants du dernier tirage, utilisés UNIQUEMENT pour la génération du Tableau de Validation. {{{lastWinningNumbers}}}
-   constantToAdd : La constante à utiliser pour la génération du Tableau de Validation. {{{constantToAdd}}}
-   maxLotteryNumber : Le numéro maximum possible dans cette loterie. {{{maxLotteryNumber}}}
-   historicalData : Données historiques des tirages passés pour ce type de tirage. Utilisez ces données pour simuler les analyses des modèles DBN, LightGBM, Clustering, pour l'ensemble, et pour appliquer les stratégies secondaires de complétion. {{{historicalData}}}

Suivez attentivement les étapes ci-dessous pour produire l'objet JSON de sortie complet :

ÉTAPE 1 : SIMULATION DES MODÈLES D'ANALYSE (BASÉE SUR historicalData)
    a.  **Simulation DBN (Réseau Bayésien Dynamique) :**
        -   Analysez les {{{historicalData}}} pour modéliser les dépendances temporelles et les probabilités de transition entre numéros ou groupes de numéros (plages, unités) d'un tirage à l'autre.
        -   Identifiez les motifs de répétition et les numéros susceptibles d'apparaître après certains écarts.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.dbnAnalysis' (2-3 phrases).
    b.  **Simulation LightGBM (Gradient Boosting) :**
        -   Analysez les {{{historicalData}}} pour prédire la probabilité d'apparition de chaque numéro. Considérez des caractéristiques comme la fréquence, les écarts, les co-occurrences, les sommes des numéros tirés, les plages et les unités.
        -   Identifiez les numéros ayant une forte probabilité d'apparition selon cette approche.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.lightgbmAnalysis' (2-3 phrases).
    c.  **Simulation Modèle de Clustering :**
        -   Analysez les {{{historicalData}}} pour regrouper les tirages similaires (clusters) en fonction de leur composition (plages, unités, sommes, différences internes, écarts temporels).
        -   Identifiez le profil (cluster) du contexte de tirage actuel ou récent et déterminez les numéros les plus probables pour ce profil.
        -   Fournissez un résumé de cette analyse dans 'simulatedModelInsights.clusteringAnalysis' (2-3 phrases).
    d.  **Simulation Modèle d'Ensemble Pondéré :**
        -   Combinez conceptuellement les informations et les numéros clés issus des simulations DBN, LightGBM, et Clustering. Appliquez une pondération indicative (par exemple, DBN 40%, LightGBM 30%, Clustering 30%).
        -   Générez une liste de 5 à 10 'ensembleCandidateNumbers' (numéros candidats uniques et triés) qui représentent les prédictions les plus fortes de cet ensemble simulé. Stockez cela dans 'simulatedModelInsights.ensembleCandidateNumbers'.

ÉTAPE 2 : GÉNÉRATION DU TABLEAU DE VALIDATION (5x5) (BASÉE SUR lastWinningNumbers et constantToAdd)
    a.  Première ligne :
        i.  Prenez les 'lastWinningNumbers' fournis en entrée.
        ii. Ajoutez 'constantToAdd' à chaque numéro.
        iii.Si un résultat dépasse 'maxLotteryNumber', soustrayez 'maxLotteryNumber' de ce résultat. Si le résultat est 0, utilisez 'maxLotteryNumber'. Assurez-vous que le résultat final est >= 1.
        iv. Formez la première ligne avec les 5 numéros obtenus.
    b.  Deuxième à cinquième lignes :
        i.  Pour chaque nouvelle ligne, utilisez la ligne *précédente* comme base.
        ii. Ajoutez 'constantToAdd' à chaque numéro de la ligne précédente.
        iii.Ajustez comme en (a.iii).
        iv. Conservez les 5 numéros pour la nouvelle ligne.
    c.  Produisez le 'generatedTable' (un tableau de 5 tableaux de 5 numéros).
    d.  Produisez 'uniqueNumbersInTable' : la liste de tous les numéros uniques (triés par ordre croissant) présents dans 'generatedTable'.

ÉTAPE 3 : EXTRACTION DES PAIRES DU TABLEAU DE VALIDATION (POUR INFORMATION)
    a.  À partir du 'generatedTable' :
        i.  Lignes : Extrayez toutes les paires de chiffres adjacents. Formez des numéros à partir de ces paires si la valeur est >= 1 et <= 'maxLotteryNumber'.
        ii. Colonnes : Faites de même pour les colonnes.
        iii.Diagonales : Faites de même pour les diagonales principales et secondaires.
    b.  Produisez 'uniqueNumbersFromPairs' : la liste de tous les numéros uniques (triés par ordre croissant, entre 1 et 'maxLotteryNumber') formés à partir de ces paires. Cette liste est pour information.

ÉTAPE 4 : FILTRAGE DES NUMÉROS DE L'ENSEMBLE PAR LE TABLEAU DE VALIDATION
    a.  Comparez les 'simulatedModelInsights.ensembleCandidateNumbers' avec 'uniqueNumbersInTable'.
    b.  Identifiez les numéros candidats de l'ensemble qui sont ÉGALEMENT présents dans 'uniqueNumbersInTable'. Ce sont vos candidats principaux pour la prédiction finale.

ÉTAPE 5 : COMPLÉTION DES PRÉDICTIONS FINALES
    a.  Si vous avez 5 numéros ou plus issus de l'ÉTAPE 4.b, sélectionnez les 5 meilleurs (par exemple, ceux apparaissant le plus souvent dans le raisonnement des modèles simulés DBN/LightGBM/Clustering, ou ceux que l'ensemble pondéré a le plus favorisés).
    b.  Si vous avez moins de 5 numéros :
        i.  Prenez ceux que vous avez identifiés à l'ÉTAPE 4.b.
        ii. Pour compléter jusqu'à 5 numéros, sélectionnez des numéros supplémentaires parmi les 'simulatedModelInsights.ensembleCandidateNumbers' qui N'ÉTAIENT PAS dans le tableau.
        iii.Pour choisir ces numéros de complétion, ou si vous avez encore besoin de compléter, utilisez les stratégies de prédiction secondaires en analysant les {{{historicalData}}} (Fréquence, Co-occurrences, Écarts, Plages, Modularité, Sommes, Différences internes, etc.).
        iv. Si des numéros identifiés par l'IA ont des scores de confiance individuels estimés entre 67% et 73%, considérez-les avec attention et mentionnez-le dans l'explication finale.
    c.  Assurez-vous que les 5 'finalPredictedNumbers' sont uniques et compris entre 1 et 'maxLotteryNumber'. Triez-les par ordre croissant.

ÉTAPE 6 : NUMÉROS PRÉDITS FINAUX, SCORES ET EXPLICATION
    a.  Produisez 'finalPredictedNumbers' : la liste finale des 5 numéros.
    b.  Produisez 'finalConfidenceScores' : un score de confiance (0-1) pour chacun des 5 'finalPredictedNumbers'. Ces scores doivent refléter la force de la prédiction après l'ensemble du processus (qualité des simulations, accord avec le tableau, stratégies de complétion).
    c.  Produisez 'finalPredictionExplanation' (en FRANÇAIS) :
        i.  Décrivez brièvement comment les simulations DBN, LightGBM, et Clustering ont analysé les {{{historicalData}}} et quels types d'informations elles ont fournies.
        ii. Expliquez comment l'ensemble simulé a combiné ces informations pour générer les 'ensembleCandidateNumbers'.
        iii.Décrivez la génération du 'generatedTable'.
        iv. Expliquez comment les 'ensembleCandidateNumbers' ont été filtrés par le 'generatedTable'.
        v.  Justifiez chaque numéro dans 'finalPredictedNumbers' : s'il vient du filtrage par le tableau, s'il a été ajouté en complétion (et selon quelle stratégie secondaire basée sur {{{historicalData}}}).
        vi. Mentionnez toute considération spéciale (ex: numéros avec confiance entre 67-73%).
        vii.Soulignez que chaque type de tirage est indépendant et que l'analyse s'est basée uniquement sur les données fournies pour CE tirage.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Le champ 'historicalData' est crucial pour les simulations des modèles et les stratégies secondaires.
N'utilisez que les données du tirage {{{lastWinningNumbers}}} et {{{historicalData}}} pour faire des prédictions, sans référence à d'autres tirages car ils sont indépendants.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow_v4_ComprehensiveSystem',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async (input): Promise<GenerateLottoPredictionsOutput> => {
    const {output} = await generateLottoPredictionsPrompt(input);

    if (!output) {
        throw new Error("L'IA n'a pas réussi à générer de prédictions. La sortie était nulle ou indéfinie.");
    }

    // Extensive validation of the complex output structure
    if (!output.generatedTable || output.generatedTable.length !== 5 || !output.generatedTable.every(row => Array.isArray(row) && row.length === 5 && row.every(num => typeof num === 'number' && num >=1 && num <= input.maxLotteryNumber))) {
        console.warn("L'IA a retourné un 'generatedTable' invalide:", output.generatedTable);
        throw new Error(`L'IA n'a pas retourné un 'generatedTable' (5x5) valide avec des numéros entre 1 et ${input.maxLotteryNumber}.`);
    }
    if (!output.uniqueNumbersInTable || !Array.isArray(output.uniqueNumbersInTable) || !output.uniqueNumbersInTable.every(num => typeof num === 'number' && num >=1 && num <= input.maxLotteryNumber)) {
        console.warn("L'IA a retourné 'uniqueNumbersInTable' invalide:", output.uniqueNumbersInTable);
        throw new Error(`L'IA n'a pas retourné une liste valide pour 'uniqueNumbersInTable' avec des numéros entre 1 et ${input.maxLotteryNumber}.`);
    }
     if (!output.uniqueNumbersFromPairs || !Array.isArray(output.uniqueNumbersFromPairs) || !output.uniqueNumbersFromPairs.every(num => typeof num === 'number' && num >=1 && num <= input.maxLotteryNumber)) {
        console.warn("L'IA a retourné 'uniqueNumbersFromPairs' invalide:", output.uniqueNumbersFromPairs);
        throw new Error(`L'IA n'a pas retourné une liste valide pour 'uniqueNumbersFromPairs' avec des numéros entre 1 et ${input.maxLotteryNumber}.`);
    }

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

    if (!output.finalPredictionExplanation || typeof output.finalPredictionExplanation !== 'string' || output.finalPredictionExplanation.trim() === "" || output.finalPredictionExplanation.length < 100) { // Increased length check for more detailed explanation
        console.warn("L'IA a retourné une chaîne 'finalPredictionExplanation' vide, manquante ou trop courte. Sortie :", output.finalPredictionExplanation);
        output.finalPredictionExplanation = `L'IA n'a pas fourni d'explication suffisamment détaillée pour ces prédictions finales. La stratégie simulée inclut l'analyse DBN, LightGBM, Clustering, un ensemble pondéré, la génération d'un tableau de validation (${output.generatedTable?.length} lignes), et un filtrage. Numéros finaux: ${output.finalPredictedNumbers?.join(', ')}.`;
    }
    
    // Sort informational arrays for consistency if needed by UI
    output.uniqueNumbersInTable.sort((a,b) => a - b);
    output.uniqueNumbersFromPairs.sort((a,b) => a - b);
    output.simulatedModelInsights.ensembleCandidateNumbers.sort((a,b) => a - b);

    return output;
  }
);
// Final comment to ensure build re-evaluation for draw independence constraint.
// Re-checking instructions for the new comprehensive system.
// Ensuring all aspects of the new 6-part strategy are covered in the prompt.
// Validating output schema corresponds to the new multi-faceted explanation and intermediate simulated results.
// Adding a small change to trigger re-evaluation.

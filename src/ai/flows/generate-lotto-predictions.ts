
// Implémentation de la prédiction des tirages du Loto Bonheur.
'use server';

/**
 * @fileOverview Genkit flow to generate Loto Bonheur predictions using a complex, multi-step strategy
 * involving table generation, simulated algorithm predictions, and rule-based filtering.
 *
 * - generateLottoPredictions - A function that generates lottery predictions based on the new strategy.
 * - GenerateLottoPredictionsInput - The input type for the generateLottoPredictions function.
 * - GenerateLottoPredictionsOutput - The return type for the generateLottoPredictionsOutput function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

// Corrected input field descriptions to match the prompt's usage
export const GenerateLottoPredictionsInputSchema = z.object({
  lastWinningNumbers: z
    .array(z.number().min(1))
    .length(5, { message: "Doit fournir exactement 5 numéros du dernier tirage."})
    .describe('Les 5 numéros gagnants du tout dernier tirage.'),
  constantToAdd: z
    .number()
    .min(1)
    .describe('La constante à ajouter pour la génération du tableau.'),
  maxLotteryNumber: z
    .number()
    .min(10) // e.g., 49, 90
    .describe('Le numéro maximum possible dans cette loterie (ex: 90).'),
  historicalData: z // This field is crucial for the AI's analysis
    .string()
    .min(50, { message: "Les données historiques doivent être suffisamment substantielles."})
    .describe(
      'Données historiques complètes des tirages passés (dates, numéros gagnants, numéros machine) pour ce type de tirage, utilisées par lIA pour simuler les prédictions algorithmiques et appliquer les stratégies secondaires. Format : "Date: YYYY-MM-DD, Gagnants: N1,N2,N3,N4,N5, Machine: M1,M2; ..."'
    ),
});
export type GenerateLottoPredictionsInput = z.infer<
  typeof GenerateLottoPredictionsInputSchema
>;

const AlgorithmPredictionSchema = z.object({
    predictedNumbers: z.array(z.number().min(1)).min(5, "Les algorithmes doivent prédire au moins 5 numéros."),
    confidenceScores: z.array(z.number().min(0).max(1)).min(5, "Les algorithmes doivent fournir au moins 5 scores de confiance."),
    analysis: z.string().describe("Analyse simulée des algorithmes (XGBoost, RF, LSTM, Hybride) expliquant leurs prédictions brutes basées sur historicalData."),
});

export const GenerateLottoPredictionsOutputSchema = z.object({
  generatedTable: z
    .array(z.array(z.number().min(1)).length(5, "Chaque ligne du tableau doit contenir 5 numéros."))
    .length(5, "Le tableau généré doit contenir 5 lignes.")
    .describe("Le tableau 5x5 généré selon la stratégie."),
  uniqueNumbersInTable: z.array(z.number().min(1)).describe("Liste des numéros uniques présents dans le tableau généré."),
  uniqueNumbersFromPairs: z.array(z.number().min(1)).describe("Liste informationnelle des numéros uniques (1-90) formés à partir des paires de chiffres extraites du tableau."),
  algorithmRawPredictions: AlgorithmPredictionSchema.describe("Prédictions brutes simulées par les algorithmes avant le filtrage par le tableau."),
  finalPredictedNumbers: z
    .array(z.number().min(1).max(90)) // Max 90 constraint added here
    .length(5, "La prédiction finale doit contenir exactement 5 numéros uniques.")
    .describe('Les 5 numéros finaux prédits pour le prochain tirage, après filtrage et complétion.'),
  finalConfidenceScores: z
    .array(z.number().min(0).max(1))
    .length(5, "Doit fournir 5 scores de confiance pour les numéros finaux.")
    .describe('Scores de confiance pour chaque numéro final prédit, reflétant la stratégie globale.'),
  finalPredictionExplanation: z.string().describe("Explication détaillée en FRANÇAIS des choix finaux, justifiant chaque numéro par sa présence dans le tableau, l'accord avec les algorithmes simulés, et/ou les stratégies de prédiction secondaires (fréquences, co-occurrences, écarts, modularité, sommes, différences internes, etc.) basées sur historicalData."),
});
export type GenerateLottoPredictionsOutput = z.infer<
  typeof GenerateLottoPredictionsOutputSchema
>;

export async function generateLottoPredictions(
  input: GenerateLottoPredictionsInput
): Promise<GenerateLottoPredictionsOutput> {
  // Safeguard: Validate that input and lastWinningNumbers are present before using .some()
  if (!input || !input.lastWinningNumbers) {
    throw new Error("Les données d'entrée sont invalides ou 'lastWinningNumbers' est manquant.");
  }
  // Validate that numbers in lastWinningNumbers are within maxLotteryNumber
  if (input.lastWinningNumbers.some(n => n > input.maxLotteryNumber)) {
    throw new Error(`Certains numéros du dernier tirage dépassent le numéro maximum autorisé de ${input.maxLotteryNumber}.`);
  }
  return generateLottoPredictionsFlow(input);
}

// Note: If a 503 Service Unavailable error occurs here, it's an external API issue (model overloaded).
// The application should catch this error in the calling component and inform the user to try again later.
const generateLottoPredictionsPrompt = ai.definePrompt({
  name: 'generateLottoPredictionsPrompt_v3_Strategy',
  input: {schema: GenerateLottoPredictionsInputSchema},
  output: {schema: GenerateLottoPredictionsOutputSchema},
  prompt: `Vous êtes une IA experte en stratégies de loterie pour des tirages où les numéros vont de 1 à {{maxLotteryNumber}}. Votre tâche est de générer une prédiction de 5 numéros pour le prochain tirage en suivant une stratégie complexe. Chaque type de tirage est indépendant. Basez votre analyse *exclusivement* sur les données fournies pour le tirage concerné.

Données d'entrée :
-   lastWinningNumbers : Les 5 numéros gagnants du dernier tirage. {{{lastWinningNumbers}}}
-   constantToAdd : La constante à utiliser pour la génération du tableau. {{{constantToAdd}}}
-   maxLotteryNumber : Le numéro maximum possible dans cette loterie. {{{maxLotteryNumber}}}
-   historicalData : Données historiques des tirages passés pour ce type de tirage. Utilisez ces données pour simuler les prédictions des algorithmes et pour appliquer les stratégies secondaires (fréquence, co-occurrence, etc.). {{{historicalData}}}

Suivez attentivement les étapes ci-dessous :

ÉTAPE PRÉLIMINAIRE (INTERNE - SIMULATION DES ALGORITHMES) :
1.  Analysez les {{{historicalData}}} fournies pour ce tirage spécifique. Simulez les prédictions d'une approche hybride sophistiquée (combinant conceptuellement XGBoost, Random Forest, RNN-LSTM).
    *   XGBoost (simulé) : Analysez les fréquences, écarts, différences internes/positionnelles, sommes, unités modulo 10. Priorisez numéros/plages fréquents et ceux avec des écarts significatifs.
    *   Random Forest (simulé) : Modélisez les paires consécutives, interactions/combinaisons par plage.
    *   RNN-LSTM (simulé) : Capturez les séquences temporelles (différences, sommes, unités), les écarts, pour prédire les récurrences/tendances.
2.  Générez un ensemble de prédictions brutes issues de cette simulation : 5 à 10 numéros, leurs scores de confiance (0-1), et une brève analyse de ces prédictions brutes. Stockez cela pour l'utiliser à l'étape "ALGORITHM RAW PREDICTIONS OUTPUT" et à l'étape "VÉRIFICATION".

ÉTAPE 1 : GÉNÉRATION DU TABLEAU (5x5)
1.  Première ligne :
    a.  Prenez les 'lastWinningNumbers'.
    b.  Ajoutez 'constantToAdd' à chaque numéro.
    c.  Si un résultat dépasse 'maxLotteryNumber', soustrayez 'maxLotteryNumber' de ce résultat (modulo effectif). Assurez-vous que le résultat final est >= 1. Si après soustraction, le résultat est 0, utilisez 'maxLotteryNumber'.
    d.  Formez la première ligne avec les 5 numéros obtenus.
2.  Deuxième à cinquième lignes :
    a.  Pour chaque nouvelle ligne, utilisez la ligne *précédente* comme base.
    b.  Ajoutez 'constantToAdd' à chaque numéro de la ligne précédente.
    c.  Si un résultat dépasse 'maxLotteryNumber', soustrayez 'maxLotteryNumber'. Assurez-vous que le résultat final est >= 1. Si après soustraction, le résultat est 0, utilisez 'maxLotteryNumber'.
    d.  Conservez les 5 numéros pour la nouvelle ligne.
3.  Produisez le 'generatedTable' (un tableau de 5 tableaux de 5 numéros).
4.  Produisez 'uniqueNumbersInTable' : la liste de tous les numéros uniques (triés par ordre croissant) présents dans 'generatedTable'.

ÉTAPE 2 : EXTRACTION DES PAIRES (POUR INFORMATION - uniqueNumbersFromPairs)
1.  À partir du 'generatedTable' :
    a.  Lignes : Pour chaque ligne, extrayez toutes les paires de chiffres adjacents (ex: si une ligne a [12, 5, 38], les chiffres sont 1,2,5,3,8. Les paires sont 12, 25, 53, 38). Formez des numéros à partir de ces paires si la valeur est >= 1 et <= 'maxLotteryNumber' (ex: 12 -> 12, 25 -> 25).
    b.  Colonnes : Pour chaque colonne, extrayez les paires de chiffres adjacents verticalement. Formez des numéros (>=1 et <= 'maxLotteryNumber').
    c.  Diagonales : Extrayez les paires de chiffres adjacents le long des diagonales principales (haut-gauche vers bas-droit et haut-droit vers bas-gauche) et des autres diagonales significatives si possible. Formez des numéros (>=1 et <= 'maxLotteryNumber').
2.  Produisez 'uniqueNumbersFromPairs' : la liste de tous les numéros uniques (triés par ordre croissant, entre 1 et 'maxLotteryNumber') formés à partir de ces paires de chiffres. Cette liste est pour information.

ÉTAPE 3 : RAPPORTER LES PRÉDICTIONS ALGORITHMIQUES BRUTES
1.  Utilisez les prédictions simulées à l'ÉTAPE PRÉLIMINAIRE.
2.  Produisez 'algorithmRawPredictions' : un objet avec 'predictedNumbers' (tableau de 5 à 10 numéros triés), 'confidenceScores' (tableau de scores correspondants), et 'analysis' (l'analyse de ces prédictions brutes).

ÉTAPE 4 : VÉRIFICATION ET FILTRAGE DES NUMÉROS PRÉDITS PAR LES ALGORITHMES
1.  Comparez les 'algorithmRawPredictions.predictedNumbers' avec 'uniqueNumbersInTable'.
2.  Identifiez les numéros prédits par les algorithmes qui sont ÉGALEMENT présents dans 'uniqueNumbersInTable'. Ce sont vos candidats principaux.

ÉTAPE 5 : COMPLÉTION DES PRÉDICTIONS FINALES
1.  Si vous avez 5 numéros ou plus issus de l'ÉTAPE 4, sélectionnez les 5 meilleurs (par exemple, ceux avec les plus hauts scores de confiance initiaux de 'algorithmRawPredictions', ou ceux qui apparaissent le plus fréquemment dans le tableau si applicable, ou une combinaison).
2.  Si vous avez moins de 5 numéros :
    a.  Prenez ceux que vous avez identifiés à l'ÉTAPE 4.
    b.  Pour compléter jusqu'à 5 numéros, sélectionnez des numéros supplémentaires parmi les 'algorithmRawPredictions.predictedNumbers' qui N'ÉTAIENT PAS dans le tableau.
    c.  Pour choisir ces numéros de complétion, appliquez les stratégies de prédiction secondaires en analysant les {{{historicalData}}} :
        *   Fréquence : Numéros apparaissant souvent.
        *   Co-occurrences : Paires de numéros fréquemment tirées ensemble.
        *   Écarts : Numéros apparus récemment ou attendus.
        *   Plages : Priorité à certaines plages de numéros.
        *   Modularité : Unités (dernier chiffre) fréquentes.
        *   Sommes : Viser une somme cible pour la combinaison totale des 5 numéros.
        *   Différences internes : Viser une différence moyenne spécifique entre les numéros.
    d.  Assurez-vous que les 5 'finalPredictedNumbers' sont uniques et compris entre 1 et 'maxLotteryNumber'.

ÉTAPE 6 : NUMÉROS PRÉDITS FINAUX ET EXPLICATION
1.  Produisez 'finalPredictedNumbers' : la liste finale des 5 numéros, triés par ordre croissant.
2.  Produisez 'finalConfidenceScores' : un score de confiance (0-1) pour chacun des 5 'finalPredictedNumbers'. Ces scores doivent refléter la force de la prédiction après l'ensemble du processus (présence dans le tableau, accord avec les algorithmes, stratégies de complétion).
3.  Produisez 'finalPredictionExplanation' (en FRANÇAIS) :
    a.  Justifiez chaque numéro dans 'finalPredictedNumbers'.
    b.  Expliquez s'il vient du filtrage par le tableau et des algorithmes simulés.
    c.  S'il a été ajouté en complétion, expliquez quelle(s) stratégie(s) secondaire(s) (fréquence, co-occurrence, écarts, modularité, sommes, différences internes, etc., basées sur {{{historicalData}}}) ont justifié son inclusion.
    d.  Mentionnez brièvement comment la simulation des algorithmes (XGBoost, RF, LSTM), en utilisant les caractéristiques que vous avez été instruit d'analyser (différences internes/positionnelles, sommes, unités, paires, interactions de plages, séquences temporelles, écarts), a informé les 'algorithmRawPredictions'.
    e.  Si certains numéros finaux ont une confiance qui se situe entre 67% et 73%, signalez-le et expliquez pourquoi cette confiance (ni trop basse, ni trop haute) est considérée comme pertinente pour ces numéros spécifiques dans le contexte de votre analyse globale.

Assurez-vous que votre sortie est un objet JSON valide respectant le schéma de sortie.
Tous les numéros dans les listes de numéros doivent être triés par ordre croissant, sauf indication contraire (comme les numéros dans les lignes du tableau qui doivent conserver leur ordre de génération).
Les 5 numéros dans 'finalPredictedNumbers' doivent être UNIQUES et entre 1 et 'maxLotteryNumber'.
Le champ 'historicalData' est crucial pour les prédictions algorithmiques simulées et les stratégies secondaires.
N'utilisez que les données du tirage {{{lastWinningNumbers}}} et {{{historicalData}}} pour faire des prédictions, sans référence à d'autres tirages car ils sont indépendants.
`,
});

const generateLottoPredictionsFlow = ai.defineFlow(
  {
    name: 'generateLottoPredictionsFlow_v3_Strategy',
    inputSchema: GenerateLottoPredictionsInputSchema,
    outputSchema: GenerateLottoPredictionsOutputSchema,
  },
  async (input): Promise<GenerateLottoPredictionsOutput> => {
    // Note: If a 503 Service Unavailable error occurs here, it's an external API issue (model overloaded).
    // The application should catch this error in the calling component and inform the user to try again later.
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

    if (!output.algorithmRawPredictions ||
        !output.algorithmRawPredictions.predictedNumbers || !Array.isArray(output.algorithmRawPredictions.predictedNumbers) || output.algorithmRawPredictions.predictedNumbers.length < 5 || !output.algorithmRawPredictions.predictedNumbers.every(num => typeof num === 'number' && num >=1 && num <= input.maxLotteryNumber) ||
        !output.algorithmRawPredictions.confidenceScores || !Array.isArray(output.algorithmRawPredictions.confidenceScores) || output.algorithmRawPredictions.confidenceScores.length < 5 || !output.algorithmRawPredictions.confidenceScores.every(score => typeof score === 'number' && score >=0 && score <=1)||
        !output.algorithmRawPredictions.analysis || typeof output.algorithmRawPredictions.analysis !== 'string' || output.algorithmRawPredictions.analysis.trim() === "") {
        console.warn("L'IA a retourné 'algorithmRawPredictions' invalides:", output.algorithmRawPredictions);
        throw new Error(`L'IA n'a pas retourné des 'algorithmRawPredictions' valides (numéros entre 1-${input.maxLotteryNumber}, scores 0-1, analyse non vide).`);
    }
     if (output.algorithmRawPredictions.predictedNumbers.length !== output.algorithmRawPredictions.confidenceScores.length) {
        console.warn("Discordance de longueur entre predictedNumbers et confidenceScores dans algorithmRawPredictions:", output.algorithmRawPredictions);
        throw new Error("Discordance de longueur entre les numéros prédits et les scores de confiance dans les prédictions brutes des algorithmes.");
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

    if (!output.finalPredictionExplanation || typeof output.finalPredictionExplanation !== 'string' || output.finalPredictionExplanation.trim() === "" || output.finalPredictionExplanation.length < 50) {
        console.warn("L'IA a retourné une chaîne 'finalPredictionExplanation' vide, manquante ou très courte. Sortie :", output.finalPredictionExplanation);
        // Do not throw an error, but provide a default or log. The core prediction might still be useful.
        output.finalPredictionExplanation = "L'IA n'a pas fourni d'explication détaillée pour ces prédictions finales. Vérifiez la stratégie et les données d'entrée.";
    }
    
    // Sort informational arrays for consistency if needed by UI
    output.uniqueNumbersInTable.sort((a,b) => a - b);
    output.uniqueNumbersFromPairs.sort((a,b) => a - b);
    output.algorithmRawPredictions.predictedNumbers.sort((a,b) => a - b);


    return output;
  }
);
// Minor adjustment for potential build re-evaluation.
// Adding another comment to ensure the file is marked as changed.
// Further refinement for general stability pass.
// Final comment to ensure build re-evaluation for draw independence constraint.

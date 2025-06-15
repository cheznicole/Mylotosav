
'use server';
/**
 * @fileOverview Predicts lottery numbers based on a user-provided strategy.
 *
 * - predictLottoNumbersWithStrategy - A function that predicts lottery numbers based on a user-defined strategy.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const PredictLottoNumbersWithStrategyInputSchema = z.object({
  strategyPrompt: z
    .string()
    .min(10, "La description de la stratégie est trop courte.") 
    .describe('Une description de la stratégie de loterie à utiliser pour prédire les numéros.'),
});
type PredictLottoNumbersWithStrategyInput =
  z.infer<typeof PredictLottoNumbersWithStrategyInputSchema>;

const PredictLottoNumbersWithStrategyOutputSchema = z.object({
  predictedNumbers: z
    .array(z.number())
    .length(6)
    .describe('Un tableau de 6 numéros de loterie prédits en fonction de la stratégie fournie.'),
  confidenceScores: z
    .array(z.number().min(0).max(1)) 
    .length(6)
    .describe('Un tableau de scores de confiance (0-1) pour chaque numéro prédit, reflétant sa conformité à la stratégie.'),
  explanation: z
    .string()
    .optional()
    .describe('Une brève explication en FRANÇAIS (1-2 phrases) de la manière dont l\'IA a interprété et appliqué la stratégie de l\'utilisateur pour générer les numéros et leurs scores de confiance.'),
});
type PredictLottoNumbersWithStrategyOutput =
  z.infer<typeof PredictLottoNumbersWithStrategyOutputSchema>;

export async function predictLottoNumbersWithStrategy(
  input: PredictLottoNumbersWithStrategyInput
): Promise<PredictLottoNumbersWithStrategyOutput> {
  return predictLottoNumbersWithStrategyFlow(input);
}
// Minor modification to ensure this file is re-evaluated.
const prompt = ai.definePrompt({
  name: 'predictLottoNumbersWithStrategyPrompt',
  input: {schema: PredictLottoNumbersWithStrategyInputSchema},
  output: {schema: PredictLottoNumbersWithStrategyOutputSchema},
  prompt: `Vous êtes un prédicteur de numéros de loterie IA. Basé sur la stratégie fournie par l'utilisateur, prédisez exactement 6 numéros de loterie, chacun entre 1 et 49 (inclus). Générez également un score de confiance entre 0 et 1 (inclus) pour chaque numéro prédit.

Stratégie utilisateur : {{{strategyPrompt}}}

Vos tâches :
1.  **Interpréter la stratégie** : Comprendre la logique de base et les contraintes de la stratégie de l'utilisateur.
2.  **Prédire les numéros** : Générer 6 numéros uniques qui suivent strictement la stratégie de l'utilisateur.
3.  **Attribuer des scores de confiance** : Pour chaque numéro prédit, attribuer un score de confiance (0-1). Ce score doit représenter à quel point ce numéro spécifique correspond à la stratégie donnée. Un score plus élevé signifie une meilleure adéquation selon votre interprétation de la stratégie.
4.  **Fournir une explication (pour le champ 'explanation', en FRANÇAIS)** : Expliquez brièvement en FRANÇAIS (1-2 phrases) comment vous avez appliqué la stratégie de l'utilisateur pour arriver aux numéros prédits et à leurs scores de confiance. Liez directement vos choix à la stratégie fournie.

Répondez avec un objet JSON conforme au schéma de sortie.
Le champ "predictedNumbers" doit être un tableau de 6 entiers uniques.
Le champ "confidenceScores" doit être un tableau de 6 nombres à virgule flottante entre 0 et 1.
Le champ "explanation" doit décrire clairement et de manière concise votre application de la stratégie, en FRANÇAIS.
`,
});

const predictLottoNumbersWithStrategyFlow = ai.defineFlow(
  {
    name: 'predictLottoNumbersWithStrategyFlow',
    inputSchema: PredictLottoNumbersWithStrategyInputSchema,
    outputSchema: PredictLottoNumbersWithStrategyOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("L'IA n'a pas réussi à générer une prédiction basée sur la stratégie. La sortie était nulle ou indéfinie.");
    }
    
    const uniquePredictedNumbers = [...new Set(output.predictedNumbers)];
    if (uniquePredictedNumbers.length !== 6) {
        throw new Error("L'IA a prédit des numéros non uniques ou un nombre incorrect pour la prédiction basée sur la stratégie. Attendu : 6 numéros uniques.");
    }
    if (!output.explanation || output.explanation.trim() === "") {
        console.warn("L'IA a retourné une explication vide ou manquante pour la prédiction basée sur la stratégie.");
        output.explanation = "L'IA n'a pas fourni d'explication pour cette prédiction basée sur la stratégie.";
    }
    return output;
  }
);
// Minor modification to encourage re-evaluation due to build warnings.


"use client";

import { useState, useEffect } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from '@/hooks/use-toast';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Loader2, Wand2, FileText, AlertTriangle } from 'lucide-react';
import type { AIPrediction, StrategyPrediction } from '@/types';
import { fetchLotteryResults as fetchActualLotteryResults } from '@/services/lotteryApi';
import { generateLottoPredictions } from '@/ai/flows/generate-lotto-predictions';
import { predictLottoNumbersWithStrategy } from '@/ai/flows/prompt-for-lotto-strategy';

interface PredictionEngineProps {
  drawName: string;
}

// Schemas for forms
const PastResultsFormSchema = z.object({
  pastResults: z.string().min(10, { message: "Veuillez fournir des résultats passés." }),
});
type PastResultsFormData = z.infer<typeof PastResultsFormSchema>;

const StrategyFormSchema = z.object({
  strategyPrompt: z.string().min(10, { message: "Veuillez décrire votre stratégie." }),
});
type StrategyFormData = z.infer<typeof StrategyFormSchema>;


export default function PredictionEngine({ drawName }: PredictionEngineProps) {
  const { toast } = useToast();
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelPrediction, setModelPrediction] = useState<AIPrediction | null>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [strategyPrediction, setStrategyPrediction] = useState<StrategyPrediction | null>(null);
  const [initialPastResults, setInitialPastResults] = useState("");
  const [error, setError] = useState<string | null>(null);

  const pastResultsForm = useForm<PastResultsFormData>({
    resolver: zodResolver(PastResultsFormSchema),
    defaultValues: { pastResults: "" },
  });

  const strategyForm = useForm<StrategyFormData>({
    resolver: zodResolver(StrategyFormSchema),
    defaultValues: { strategyPrompt: "" },
  });

  useEffect(() => {
    async function loadInitialResults() {
      setError(null);
      try {
        const allApiResults = await fetchActualLotteryResults(); 
        const relevantApiResults = allApiResults.filter(r => r.draw_name === drawName);
        
        if (relevantApiResults.length > 0) {
            const pastResultsString = relevantApiResults
                .slice(0, 20) // Use last 20 relevant results
                .map(r => `Date: ${r.date}, Gagnants: ${r.gagnants.join(',')}${r.machine ? `, Machine: ${r.machine.join(',')}` : ''}`)
                .join('; ');
            setInitialPastResults(pastResultsString);
        } else {
            // Fallback if no specific results, provide a generic example
            setInitialPastResults(`Exemple pour ${drawName}: Date: 2024-07-20, Gagnants: 5,12,23,34,45; ... (Aucun résultat récent trouvé pour ${drawName})`);
        }

      } catch (err) {
        console.error(`Failed to load initial past results for AI for ${drawName}`, err);
        setError(`Impossible de charger les résultats passés pour ${drawName}.`);
        setInitialPastResults(`Exemple: Date: 2024-07-20, Gagnants: 5,12,23,34,45 (pour ${drawName}); ...`);
      }
    }
    if (drawName) {
        loadInitialResults();
    }
  }, [drawName]);
  
  useEffect(() => {
    if (initialPastResults && pastResultsForm.getValues("pastResults") === "") {
       pastResultsForm.reset({ pastResults: initialPastResults });
    }
  }, [initialPastResults, pastResultsForm]);


  const onPastResultsSubmit: SubmitHandler<PastResultsFormData> = async (data) => {
    setIsLoadingModel(true);
    setModelPrediction(null);
    setError(null);
    try {
      // The AI flow might need to be aware of the drawName if models are category-specific.
      // For now, it uses the provided pastResults string.
      const result = await generateLottoPredictions({ pastResults: data.pastResults });
      setModelPrediction(result);
      toast({ title: "Prédiction Générée", description: "Prédiction basée sur le modèle réussie." });
    } catch (error) {
      console.error("Error generating model prediction:", error);
      setError("Impossible de générer la prédiction basée sur le modèle.");
      toast({ variant: "destructive", title: "Erreur de Prédiction", description: "Impossible de générer la prédiction basée sur le modèle." });
    } finally {
      setIsLoadingModel(false);
    }
  };

  const onStrategySubmit: SubmitHandler<StrategyFormData> = async (data) => {
    setIsLoadingStrategy(true);
    setStrategyPrediction(null);
    setError(null);
    try {
      // The AI flow might need to be aware of the drawName.
      const result = await predictLottoNumbersWithStrategy({ strategyPrompt: data.strategyPrompt });
      setStrategyPrediction(result);
      toast({ title: "Prédiction Générée", description: "Prédiction basée sur la stratégie réussie." });
    } catch (error) {
      console.error("Error generating strategy prediction:", error);
      setError("Impossible de générer la prédiction basée sur la stratégie.");
      toast({ variant: "destructive", title: "Erreur de Prédiction", description: "Impossible de générer la prédiction basée sur la stratégie." });
    } finally {
      setIsLoadingStrategy(false);
    }
  };

  const renderPrediction = (prediction: AIPrediction | StrategyPrediction | null, title: string, analysis?: string) => {
    if (!prediction || !Array.isArray(prediction.predictedNumbers) || !Array.isArray(prediction.confidenceScores)) {
      return null;
    }
    
    if (prediction.predictedNumbers.length === 0 || prediction.confidenceScores.length === 0) {
      return (
        <Card className="mt-6 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg text-primary">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Aucune donnée de prédiction à afficher.</p>
            {analysis && (
            <div>
              <h4 className="font-semibold mb-2 mt-4">Analyse:</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">{analysis}</p>
            </div>
          )}
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle className="text-lg text-primary">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Numéros Prédits:</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.predictedNumbers.map((num, index) => (
                <LotteryNumberDisplay key={`pred-num-${num}-idx-${index}`} number={num} />
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Scores de Confiance:</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.confidenceScores.map((score, index) => (
                <div key={`conf-score-${prediction.predictedNumbers[index]}-idx-${index}`} className="p-2 border rounded-md bg-muted/50 text-sm">
                  <span className="font-medium">{prediction.predictedNumbers[index] ?? 'N/A'}:</span> {(score * 100).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>
          {analysis && (
            <div>
              <h4 className="font-semibold mb-2">Analyse:</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">{analysis}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  
  if (error && !isLoadingModel && !isLoadingStrategy) { 
    return (
         <Card>
            <CardHeader>
                <CardTitle className="text-xl font-semibold text-primary">Prédictions IA pour {drawName}</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center p-4 mb-4 text-sm text-destructive-foreground bg-destructive rounded-lg" role="alert">
                    <AlertTriangle className="w-5 h-5 mr-3" />
                    <span className="font-medium">Erreur:</span> {error}
                </div>
            </CardContent>
         </Card>
    )
  }


  return (
    <Tabs defaultValue="model" className="w-full">
      <CardHeader className="px-0">
        <CardTitle className="text-xl font-semibold text-primary">Prédictions IA pour {drawName}</CardTitle>
        <CardDescription>
            Générez des prédictions de loterie en utilisant l'IA pour le tirage {drawName}. Choisissez votre méthode ci-dessous.
        </CardDescription>
        <TabsList className="grid w-full grid-cols-2 mt-4">
          <TabsTrigger value="model"><FileText className="w-4 h-4 mr-2" />Modèle Basé sur Résultats Passés</TabsTrigger>
          <TabsTrigger value="strategy"><Wand2 className="w-4 h-4 mr-2" />Stratégie Personnalisée</TabsTrigger>
        </TabsList>
      </CardHeader>

      <TabsContent value="model">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Prédire basé sur les Résultats Passés</CardTitle>
            <CardDescription>
              Entrez les données des résultats de loterie passés pour {drawName}. L'IA utilisera son modèle pré-entraîné pour trouver des motifs et prédire les numéros futurs.
            </CardDescription>
          </CardHeader>
          <Form {...pastResultsForm}>
            <form onSubmit={pastResultsForm.handleSubmit(onPastResultsSubmit)}>
              <CardContent>
                <FormField
                  control={pastResultsForm.control}
                  name="pastResults"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Données des Résultats de Loterie Passés ({drawName})</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`Entrez les résultats passés pour ${drawName}, ex: 'Date: 2023-01-01, Gagnants: 1,2,3,4,5, Machine: 6,7; ...'`}
                          className="min-h-[150px] text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoadingModel} className="w-full sm:w-auto">
                  {isLoadingModel && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Générer la Prédiction
                </Button>
              </CardFooter>
            </form>
          </Form>
          {isLoadingModel && <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {!isLoadingModel && renderPrediction(modelPrediction, "Prédiction Basée sur le Modèle", modelPrediction?.analysis)}
        </Card>
      </TabsContent>

      <TabsContent value="strategy">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Prédire basé sur Votre Stratégie</CardTitle>
            <CardDescription>
              Décrivez votre stratégie de sélection de numéros de loterie pour {drawName}. L'IA interprétera votre stratégie et générera des numéros en conséquence.
            </CardDescription>
          </CardHeader>
          <Form {...strategyForm}>
            <form onSubmit={strategyForm.handleSubmit(onStrategySubmit)}>
              <CardContent>
                <FormField
                  control={strategyForm.control}
                  name="strategyPrompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Votre Stratégie de Loterie ({drawName})</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`ex: 'Se concentrer sur les numéros qui ne sont pas apparus dans les 10 derniers tirages de ${drawName}, et inclure au moins deux nombres premiers.'`}
                          className="min-h-[100px] text-sm"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={isLoadingStrategy} className="w-full sm:w-auto">
                  {isLoadingStrategy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Générer la Prédiction avec Stratégie
                </Button>
              </CardFooter>
            </form>
          </Form>
          {isLoadingStrategy && <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {!isLoadingStrategy && renderPrediction(strategyPrediction, "Prédiction Basée sur la Stratégie")}
        </Card>
      </TabsContent>
    </Tabs>
  );
}

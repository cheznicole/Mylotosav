
"use client";

import { useState, useEffect, useMemo } from 'react';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Loader2, Wand2, FileText, AlertTriangle, Lightbulb, CheckSquare } from 'lucide-react';
import type { AIPrediction, StrategyPrediction } from '@/types';
import { fetchLotteryResults as fetchActualLotteryResults, DRAW_SCHEDULE, type DrawResult as ApiDrawResult } from '@/services/lotteryApi';
import { generateLottoPredictions } from '@/ai/flows/generate-lotto-predictions';
import { predictLottoNumbersWithStrategy } from '@/ai/flows/prompt-for-lotto-strategy';
import { displayPredictionConfidence, type DisplayPredictionConfidenceInput, type DisplayPredictionConfidenceOutput } from '@/ai/flows/display-prediction-confidence';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Alert, AlertTitle, AlertDescription as UiAlertDescription } from '@/components/ui/alert';

// Minor change to attempt to resolve ChunkLoadError
interface PredictionEngineProps {
  drawName: string; // This is the drawName for the overall page context
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

const ConfidenceCheckerSchema = z.object({
  selectedDrawName: z.string().min(1, {message: "Veuillez sélectionner un nom de tirage."}),
  predictedNumbers: z.string()
    .min(1, { message: "Veuillez entrer au moins un numéro."})
    .refine(value => {
        const numbers = value.split(',').map(num => parseInt(num.trim(), 10));
        return numbers.length > 0 && numbers.length <=5;
    }, { message: "Veuillez entrer entre 1 et 5 numéros."})
    .refine(value => {
        const numbers = value.split(',').map(num => parseInt(num.trim(), 10));
        const maxNum = parseInt(ConfidenceCheckerSchema.shape.maxNumber.parse(undefined) || '90', 10); // Get maxNum dynamically
        return numbers.every(num => !isNaN(num) && num >= 1 && num <= maxNum);
    }, (value) => ({ message: `Les numéros doivent être entre 1 et ${parseInt(ConfidenceCheckerSchema.shape.maxNumber.parse(value.maxNumber) || '90', 10)}.`})),
  maxNumber: z.string().refine(val => !isNaN(parseInt(val,10)) && parseInt(val,10) > 0, {message: "Numéro maximum invalide"}).default("90"),
});
type ConfidenceCheckerFormData = z.infer<typeof ConfidenceCheckerSchema>;


// Component for the new "Vérifier Confiance" Tab
function ConfidenceCheckerTab({ pageDrawName }: { pageDrawName: string }) {
  const { toast } = useToast();
  const [checkerLoading, setCheckerLoading] = useState<boolean>(false);
  const [checkerResult, setCheckerResult] = useState<DisplayPredictionConfidenceOutput | null>(null);
  const [checkerError, setCheckerError] = useState<string | null>(null);
  
  const confidenceForm = useForm<ConfidenceCheckerFormData>({
    resolver: zodResolver(ConfidenceCheckerSchema),
    defaultValues: {
      selectedDrawName: pageDrawName, // Default to the page's draw name
      predictedNumbers: "",
      maxNumber: "90",
    },
  });

  useEffect(() => {
     confidenceForm.setValue('selectedDrawName', pageDrawName);
  },[pageDrawName, confidenceForm]);

  const drawOptions = useMemo(() => {
    const options: { day: string; time: string; name: string }[] = [];
    Object.entries(DRAW_SCHEDULE).forEach(([day, times]) => {
      Object.entries(times).forEach(([time, name]) => {
        options.push({ day, time, name });
      });
    });
    return options.sort((a, b) => a.name.localeCompare(b.name));
  }, []);

  const onConfidenceCheckSubmit: SubmitHandler<ConfidenceCheckerFormData> = async (data) => {
    setCheckerLoading(true);
    setCheckerError(null);
    setCheckerResult(null);

    try {
      const numbersArray = data.predictedNumbers.split(',').map(num => parseInt(num.trim(), 10));
      const maxNumValidated = parseInt(data.maxNumber, 10);

      const historicalDraws = await fetchActualLotteryResults(data.selectedDrawName);
      if (historicalDraws.length === 0) {
        throw new Error(`Aucun historique trouvé pour le tirage ${data.selectedDrawName}. Impossible de calculer la confiance.`);
      }

      const winningNumbersHistory = historicalDraws.map(draw => draw.gagnants);
      const temporalWeights = historicalDraws.map((_, index) =>
        Math.exp(-0.1 * (historicalDraws.length - 1 - index)) // Exponential decay weights
      );

      const input: DisplayPredictionConfidenceInput = {
        predictedNumbers: numbersArray,
        winningNumbersHistory,
        maxNumber: maxNumValidated,
        temporalWeights,
      };
      
      const response = await displayPredictionConfidence(input);
      if (response.error) {
        setCheckerError(response.error);
        toast({ variant: "destructive", title: "Erreur de Calcul de Confiance", description: response.error });
      } else {
        setCheckerResult(response);
        toast({ title: "Scores de Confiance Calculés", description: `Les scores pour vos numéros dans ${data.selectedDrawName} sont affichés.` });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Une erreur est survenue.';
      setCheckerError(errorMessage);
      toast({ variant: "destructive", title: "Erreur", description: errorMessage });
    } finally {
      setCheckerLoading(false);
    }
  };
  
  const chartColors = [
    'hsl(var(--chart-1))',
    'hsl(var(--chart-2))',
    'hsl(var(--chart-3))',
    'hsl(var(--chart-4))',
    'hsl(var(--chart-5))',
  ];

  const confidenceChartData = useMemo(() => {
    if (!checkerResult?.confidenceScores || confidenceForm.getValues("predictedNumbers").trim() === "") return null;
    const labels = confidenceForm.getValues("predictedNumbers").split(',').map(num => num.trim());
    return labels.map((label, index) => ({
      name: label,
      score: checkerResult.confidenceScores?.[index] || 0,
    }));
  }, [checkerResult, confidenceForm]);

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-base">Vérifier les Scores de Confiance pour Vos Numéros</CardTitle>
        <CardDescription>
          Entrez vos numéros prédits pour un tirage spécifique. L'IA utilisera les données historiques et une analyse bayésienne pour calculer un score de confiance pour chaque numéro.
        </CardDescription>
      </CardHeader>
      <Form {...confidenceForm}>
        <form onSubmit={confidenceForm.handleSubmit(onConfidenceCheckSubmit)}>
          <CardContent className="space-y-4">
            <FormField
              control={confidenceForm.control}
              name="selectedDrawName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom du Tirage</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionnez un tirage" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {drawOptions.map(option => (
                        <SelectItem key={option.name} value={option.name}>
                          {option.name} ({option.day} {option.time})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={confidenceForm.control}
              name="predictedNumbers"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vos Numéros Prédits (jusqu'à 5, séparés par des virgules)</FormLabel>
                  <FormControl>
                    <Input placeholder="Ex: 3, 15, 27, 42, 60" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={confidenceForm.control}
              name="maxNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Numéro Maximum Possible dans ce Tirage</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={checkerLoading} className="w-full sm:w-auto">
              {checkerLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Calculer les Scores de Confiance
            </Button>
          </CardFooter>
        </form>
      </Form>

      {checkerLoading && <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
      
      {checkerError && (
        <Alert variant="destructive" className="m-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Erreur</AlertTitle>
          <UiAlertDescription>{checkerError}</UiAlertDescription>
        </Alert>
      )}

      {checkerResult?.confidenceScores && confidenceChartData && (
        <Card className="mt-6 mx-6 mb-6 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg text-primary">Scores de Confiance pour "{confidenceForm.getValues("selectedDrawName")}"</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={confidenceChartData} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))"/>
                <XAxis dataKey="name" stroke="hsl(var(--foreground))" fontSize={12} />
                <YAxis domain={[0, 1]} stroke="hsl(var(--foreground))" fontSize={12} label={{ value: 'Score de Confiance', angle: -90, position: 'insideLeft', fill: 'hsl(var(--foreground))', fontSize: 12 }} />
                <Tooltip
                    contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        borderColor: 'hsl(var(--border))',
                        borderRadius: 'var(--radius)',
                        color: 'hsl(var(--popover-foreground))'
                    }}
                    formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                    cursor={{ fill: 'hsla(var(--muted), 0.5)' }}
                />
                <Bar dataKey="score" name="Score de Confiance">
                    {confidenceChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                    ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
             <div className="mt-4 space-y-1">
                {confidenceChartData.map((item, index) => (
                    <p key={index} className="text-sm">
                        Numéro <span className="font-semibold">{item.name}</span> : <span className="font-medium text-primary">{(item.score * 100).toFixed(1)}%</span>
                    </p>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </Card>
  );
}


export default function PredictionEngine({ drawName: pageDrawName }: PredictionEngineProps) {
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
        const relevantApiResults = allApiResults.filter(r => r.draw_name === pageDrawName);
        
        if (relevantApiResults.length > 0) {
            const pastResultsString = relevantApiResults
                .slice(0, 20) // Use last 20 relevant results
                .map(r => `Date: ${r.date}, Gagnants: ${r.gagnants.join(',')}${r.machine ? `, Machine: ${r.machine.join(',')}` : ''}`)
                .join('; ');
            setInitialPastResults(pastResultsString);
        } else {
            setInitialPastResults(`Exemple pour ${pageDrawName}: Date: 2024-07-20, Gagnants: 5,12,23,34,45; ... (Aucun résultat récent trouvé pour ${pageDrawName})`);
        }

      } catch (err) {
        console.error(`Failed to load initial past results for AI for ${pageDrawName}`, err);
        setError(`Impossible de charger les résultats passés pour ${pageDrawName}.`);
        setInitialPastResults(`Exemple: Date: 2024-07-20, Gagnants: 5,12,23,34,45 (pour ${pageDrawName}); ...`);
      }
    }
    if (pageDrawName) {
        loadInitialResults();
    }
  }, [pageDrawName]);
  
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
      const result = await generateLottoPredictions({ pastResults: data.pastResults });
      setModelPrediction(result);
      toast({ title: "Prédiction Intelligente Générée", description: "Prédiction basée sur le modèle et l'analyse IA réussie." });
    } catch (error) {
      console.error("Error generating model prediction:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
      setError(`Impossible de générer la prédiction basée sur le modèle: ${errorMessage}`);
      toast({ variant: "destructive", title: "Erreur de Prédiction", description: `Impossible de générer la prédiction basée sur le modèle: ${errorMessage}` });
    } finally {
      setIsLoadingModel(false);
    }
  };

  const onStrategySubmit: SubmitHandler<StrategyFormData> = async (data) => {
    setIsLoadingStrategy(true);
    setStrategyPrediction(null);
    setError(null);
    try {
      const result = await predictLottoNumbersWithStrategy({ strategyPrompt: data.strategyPrompt });
      setStrategyPrediction(result);
      toast({ title: "Prédiction Intelligente Générée", description: "Prédiction basée sur la stratégie réussie." });
    } catch (error) {
      console.error("Error generating strategy prediction:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
      setError(`Impossible de générer la prédiction basée sur la stratégie: ${errorMessage}`);
      toast({ variant: "destructive", title: "Erreur de Prédiction", description: `Impossible de générer la prédiction basée sur la stratégie: ${errorMessage}` });
    } finally {
      setIsLoadingStrategy(false);
    }
  };

  const renderPrediction = (prediction: AIPrediction | StrategyPrediction | null, title: string, isModelPrediction: boolean = false) => {
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
            {isModelPrediction && (prediction as AIPrediction).analysis && (
            <div>
              <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA (Modèle):</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{(prediction as AIPrediction).analysis}</p>
            </div>
            )}
            {!isModelPrediction && (prediction as StrategyPrediction).explanation && (
            <div>
              <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA (Stratégie):</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{(prediction as StrategyPrediction).explanation}</p>
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
            <h4 className="font-semibold mb-2">Numéros Recommandés:</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.predictedNumbers.map((num, index) => (
                <LotteryNumberDisplay key={`pred-num-${num}-idx-${index}`} number={num} />
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Scores de Confiance Individuels:</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.confidenceScores.map((score, index) => (
                <div key={`conf-score-${prediction.predictedNumbers[index]}-idx-${index}`} className="p-2 border rounded-md bg-muted/50 text-sm">
                  <span className="font-medium">{prediction.predictedNumbers[index] ?? 'N/A'}:</span> {(score * 100).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>
          {isModelPrediction && (prediction as AIPrediction).analysis && (
            <div>
              <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA (Modèle):</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{(prediction as AIPrediction).analysis}</p>
            </div>
          )}
          {!isModelPrediction && (prediction as StrategyPrediction).explanation && (
            <div>
              <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA (Stratégie):</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{(prediction as StrategyPrediction).explanation}</p>
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
                <CardTitle className="text-xl font-semibold text-primary flex items-center">
                    <Lightbulb className="w-5 h-5 mr-2" />Prédictions Intelligentes pour {pageDrawName}
                </CardTitle>
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
        <CardTitle className="text-xl font-semibold text-primary flex items-center">
            <Lightbulb className="w-5 h-5 mr-2" />Prédictions Intelligentes pour {pageDrawName}
        </CardTitle>
        <CardDescription>
            Générez des prédictions de loterie en utilisant une analyse IA avancée pour le tirage {pageDrawName}. Choisissez votre méthode ci-dessous.
        </CardDescription>
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mt-4">
          <TabsTrigger value="model"><FileText className="w-4 h-4 mr-2" />Modèle Basé sur Résultats Passés</TabsTrigger>
          <TabsTrigger value="strategy"><Wand2 className="w-4 h-4 mr-2" />Stratégie Personnalisée</TabsTrigger>
          <TabsTrigger value="confidence-checker"><CheckSquare className="w-4 h-4 mr-2" />Vérifier Confiance Numéros</TabsTrigger>
        </TabsList>
      </CardHeader>

      <TabsContent value="model">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Prédire basé sur les Résultats Passés et Analyse IA</CardTitle>
            <CardDescription>
              Entrez les données des résultats de loterie passés pour {pageDrawName}. L'IA (Gemini) analysera ces données pour trouver des motifs, prédire les numéros futurs et fournir une explication.
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
                      <FormLabel>Données des Résultats de Loterie Passés ({pageDrawName})</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`Entrez les résultats passés pour ${pageDrawName}, ex: 'Date: 2023-01-01, Gagnants: 1,2,3,4,5, Machine: 6,7; ...'`}
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
                  Générer la Prédiction Intelligente
                </Button>
              </CardFooter>
            </form>
          </Form>
          {isLoadingModel && <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {!isLoadingModel && renderPrediction(modelPrediction, "Prédiction Basée sur le Modèle et Analyse IA", true)}
        </Card>
      </TabsContent>

      <TabsContent value="strategy">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Prédire basé sur Votre Stratégie</CardTitle>
            <CardDescription>
              Décrivez votre stratégie de sélection de numéros de loterie pour {pageDrawName}. L'IA interprétera votre stratégie et générera des numéros en conséquence. (Note: Cette méthode ne fournit pas d'explication IA détaillée comme le modèle basé sur les résultats passés).
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
                      <FormLabel>Votre Stratégie de Loterie ({pageDrawName})</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`ex: 'Se concentrer sur les numéros qui ne sont pas apparus dans les 10 derniers tirages de ${pageDrawName}, et inclure au moins deux nombres premiers.'`}
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
          {!isLoadingStrategy && renderPrediction(strategyPrediction, "Prédiction Basée sur la Stratégie", false)}
        </Card>
      </TabsContent>

      <TabsContent value="confidence-checker">
        <ConfidenceCheckerTab pageDrawName={pageDrawName} />
      </TabsContent>
    </Tabs>
  );
}


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
import { Loader2, Wand2, FileText, AlertTriangle, Lightbulb, CheckSquare, Info, TableIcon } from 'lucide-react'; // TableIcon might be removed if not used for other tables
import { fetchLotteryResults as fetchActualLotteryResults, DRAW_SCHEDULE } from '@/services/lotteryApi';
import { 
  generateLottoPredictions
} from '@/ai/flows/generate-lotto-predictions';
import { predictLottoNumbersWithStrategy } from '@/ai/flows/prompt-for-lotto-strategy';
import { displayPredictionConfidence } from '@/ai/flows/display-prediction-confidence';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Alert, AlertTitle, AlertDescription as UiAlertDescription } from '@/components/ui/alert';
// Removed Table components from here as the main prediction table is gone.
// import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


interface PredictionEngineProps {
  drawName: string; 
}

// Schema for the "Stratégie Complexe IA" - REMOVED lastWinningNumbersString and constantToAddString
const ModelPredictionFormSchema = z.object({
  maxLotteryNumberString: z
    .string()
    .min(1, "Le numéro maximum de la loterie est requis.")
    .refine(val => !isNaN(parseInt(val)) && parseInt(val) >= 10, "Doit être un nombre entier >= 10 (ex: 90)."),
  historicalData: z.string().min(50, { message: "Les données historiques sont requises (au moins 50 caractères)." }),
});
type ModelPredictionFormData = z.infer<typeof ModelPredictionFormSchema>;


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
        const maxNumFromForm = (document.getElementById('maxNumberForConfidence') as HTMLInputElement)?.value;
        const maxNum = maxNumFromForm ? parseInt(maxNumFromForm, 10) : 90;
        return numbers.every(num => !isNaN(num) && num >= 1 && num <= maxNum);
    }, (value) => {
        const maxNumFromForm = (document.getElementById('maxNumberForConfidence') as HTMLInputElement)?.value;
        const maxNum = maxNumFromForm ? parseInt(maxNumFromForm, 10) : 90;
        return { message: `Les numéros doivent être entre 1 et ${maxNum}.`};
    }),
  maxNumber: z.string().refine(val => !isNaN(parseInt(val,10)) && parseInt(val,10) >= 10, {message: "Numéro maximum invalide (doit être >= 10)"}).default("90"),
});
type ConfidenceCheckerFormData = z.infer<typeof ConfidenceCheckerSchema>;


function ConfidenceCheckerTab({ pageDrawName }: { pageDrawName: string }) {
  const { toast } = useToast();
  const [checkerLoading, setCheckerLoading] = useState<boolean>(false);
  const [checkerResult, setCheckerResult] = useState<Awaited<ReturnType<typeof displayPredictionConfidence>> | null>(null);
  const [checkerError, setCheckerError] = useState<string | null>(null);
  
  const confidenceForm = useForm<ConfidenceCheckerFormData>({
    resolver: zodResolver(ConfidenceCheckerSchema),
    defaultValues: {
      selectedDrawName: pageDrawName, 
      predictedNumbers: "",
      maxNumber: "90",
    },
     mode: "onChange",
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
        Math.exp(-0.1 * (historicalDraws.length - 1 - index)) 
      );

      const inputForConfidence: Parameters<typeof displayPredictionConfidence>[0] = {
        predictedNumbers: numbersArray,
        winningNumbersHistory,
        maxNumber: maxNumValidated,
        temporalWeights,
      };
      
      const response = await displayPredictionConfidence(inputForConfidence);
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
                    <Input type="number" id="maxNumberForConfidence" {...field} onChange={(e) => {field.onChange(e); confidenceForm.trigger("predictedNumbers");}}/>
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
  const [modelPrediction, setModelPrediction] = useState<Awaited<ReturnType<typeof generateLottoPredictions>> | null>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [strategyPrediction, setStrategyPrediction] = useState<Awaited<ReturnType<typeof predictLottoNumbersWithStrategy>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const modelPredictionForm = useForm<ModelPredictionFormData>({
    resolver: zodResolver(ModelPredictionFormSchema),
    defaultValues: {
      maxLotteryNumberString: "90", 
      historicalData: "",
    },
  });

  const strategyForm = useForm<StrategyFormData>({
    resolver: zodResolver(StrategyFormSchema),
    defaultValues: { strategyPrompt: "" },
  });

  useEffect(() => {
    async function loadInitialData() {
      setError(null);
      setIsLoadingModel(true); 
      try {
        const allApiResults = await fetchActualLotteryResults(); 
        const relevantApiResults = allApiResults
          .filter(r => r.draw_name === pageDrawName)
          .sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
        
        let historicalDataString = "";

        if (relevantApiResults.length > 0) {
            historicalDataString = relevantApiResults
                .slice(0, 100) // Use last 100 relevant results for historical data
                .map(r => `Date: ${r.date}, Gagnants: ${r.gagnants.join(',')}${r.machine && r.machine.length > 0 ? `, Machine: ${r.machine.join(',')}` : ''}`)
                .join('; ');
        } else {
            historicalDataString = `Exemple pour ${pageDrawName}: Date: 2024-07-20, Gagnants: 5,12,23,34,45; Date: 2024-07-19, Gagnants: 2,10,20,30,40; ... (Aucun résultat récent trouvé pour ${pageDrawName}, veuillez entrer des données manuellement ou via l'admin.)`;
        }

        modelPredictionForm.reset({
            maxLotteryNumberString: modelPredictionForm.getValues("maxLotteryNumberString") || "90",
            historicalData: historicalDataString,
        });

      } catch (err) {
        console.error(`Failed to load initial data for AI for ${pageDrawName}`, err);
        const loadErrorMsg = `Impossible de charger les données historiques pour ${pageDrawName}. Vérifiez la console.`;
        setError(loadErrorMsg);
        const exampleHistorical = `Exemple: Date: 2024-07-20, Gagnants: 5,12,23,34,45 (pour ${pageDrawName}); ...`;
        modelPredictionForm.reset({
            maxLotteryNumberString: "90",
            historicalData: exampleHistorical,
        });
        toast({ variant: "destructive", title: "Erreur de Chargement des Données", description: loadErrorMsg, duration: 7000 });
      } finally {
        setIsLoadingModel(false);
      }
    }
    if (pageDrawName) {
        loadInitialData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageDrawName]);
  

  const onModelPredictionSubmit: SubmitHandler<ModelPredictionFormData> = async (data) => {
    setIsLoadingModel(true);
    setModelPrediction(null);
    setError(null);
    try {
      const inputForAI: Parameters<typeof generateLottoPredictions>[0] = {
        maxLotteryNumber: parseInt(data.maxLotteryNumberString, 10),
        historicalData: data.historicalData,
      };
      const result = await generateLottoPredictions(inputForAI);
      setModelPrediction(result);
      toast({ title: "Prédiction Intelligente Générée", description: "Prédiction basée sur la stratégie complexe et l'analyse IA réussie." });
    } catch (error) {
      console.error("Error generating model prediction:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
      setError(`Impossible de générer la prédiction: ${errorMessage}`);
      toast({ variant: "destructive", title: "Erreur de Prédiction", description: `Impossible de générer la prédiction: ${errorMessage}` });
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
      toast({ title: "Prédiction par Stratégie Générée", description: "Prédiction basée sur votre stratégie personnalisée réussie." });
    } catch (error) {
      console.error("Error generating strategy prediction:", error);
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue.";
      setError(`Impossible de générer la prédiction basée sur la stratégie: ${errorMessage}`);
      toast({ variant: "destructive", title: "Erreur de Prédiction", description: `Impossible de générer la prédiction basée sur la stratégie: ${errorMessage}` });
    } finally {
      setIsLoadingStrategy(false);
    }
  };

  const renderModelPredictionDetails = (prediction: Awaited<ReturnType<typeof generateLottoPredictions>>) => {
    if (!prediction?.simulatedModelInsights) {
        return <p className="text-sm text-muted-foreground">Données de prédiction du modèle incomplètes.</p>;
    }

    const { dbnAnalysis, lightgbmAnalysis, clusteringAnalysis, ensembleCandidateNumbers } = prediction.simulatedModelInsights;

    return (
      <div className="space-y-6">
        <div>
           <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Analyses Simulées des Modèles:</h4>
           <Card className="mb-3">
             <CardHeader className="py-2 px-3"><CardTitle className="text-sm">DBN (Réseau Bayésien Dynamique)</CardTitle></CardHeader>
             <CardContent className="py-2 px-3 text-xs text-muted-foreground">{dbnAnalysis}</CardContent>
           </Card>
           <Card className="mb-3">
             <CardHeader className="py-2 px-3"><CardTitle className="text-sm">LightGBM (Gradient Boosting)</CardTitle></CardHeader>
             <CardContent className="py-2 px-3 text-xs text-muted-foreground">{lightgbmAnalysis}</CardContent>
           </Card>
           <Card className="mb-3">
             <CardHeader className="py-2 px-3"><CardTitle className="text-sm">Clustering</CardTitle></CardHeader>
             <CardContent className="py-2 px-3 text-xs text-muted-foreground">{clusteringAnalysis}</CardContent>
           </Card>
        </div>

        <div>
          <h5 className="font-medium mt-2 mb-1 text-sm">Numéros Candidats de l'Ensemble Simulé:</h5>
           <div className="flex flex-wrap gap-1">
             {ensembleCandidateNumbers.map((num, idx) => (
                <div key={`ensemble-candidate-${num}-${idx}`} className="flex items-center gap-1 p-1 border rounded-md bg-muted/50 text-xs">
                    <LotteryNumberDisplay number={num} size="sm" />
                </div>
             ))}
           </div>
        </div>

        <div>
          <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA (Prédiction Finale):</h4>
          <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{prediction.finalPredictionExplanation}</p>
        </div>
      </div>
    );
  };


  const renderPredictionOutput = (
    prediction: Awaited<ReturnType<typeof generateLottoPredictions>> | Awaited<ReturnType<typeof predictLottoNumbersWithStrategy>> | null, 
    title: string
  ) => {
    if (!prediction) return null;

    let numbersToDisplay: number[] = [];
    let confidenceToDisplay: number[] = [];
    let mainExplanation: string | undefined = undefined;
    let isModelOutputType = false;

    // Type guard for GenerateLottoPredictionsOutput
    if ('finalPredictedNumbers' in prediction && prediction.finalPredictedNumbers) { 
      const modelPred = prediction as Awaited<ReturnType<typeof generateLottoPredictions>>;
      numbersToDisplay = modelPred.finalPredictedNumbers;
      confidenceToDisplay = modelPred.finalConfidenceScores;
      // mainExplanation will be rendered by renderModelPredictionDetails for this type
      isModelOutputType = true;
    } 
    // Type guard for StrategyPredictionOutput
    else if ('predictedNumbers' in prediction && prediction.predictedNumbers) { 
      const strategyPred = prediction as Awaited<ReturnType<typeof predictLottoNumbersWithStrategy>>;
      numbersToDisplay = strategyPred.predictedNumbers;
      confidenceToDisplay = strategyPred.confidenceScores;
      mainExplanation = strategyPred.explanation;
    }

    if (numbersToDisplay.length === 0 && !isModelOutputType) { // Don't show this if model output is expected but empty
      return (
        <Card className="mt-6 shadow-md">
          <CardHeader>
            <CardTitle className="text-lg text-primary">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Aucune donnée de prédiction finale à afficher.</p>
            {mainExplanation && ( // Only show basic explanation for strategy type if numbers are empty
             <div>
              <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA:</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{mainExplanation}</p>
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
          {numbersToDisplay.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Numéros Finaux Prédits:</h4>
              <div className="flex flex-wrap gap-2">
                {numbersToDisplay.map((num, index) => (
                  <LotteryNumberDisplay key={`pred-num-${num}-idx-${index}`} number={num} />
                ))}
              </div>
            </div>
          )}
          {confidenceToDisplay && confidenceToDisplay.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2">Scores de Confiance FINAux:</h4>
              <div className="flex flex-wrap gap-2">
                {confidenceToDisplay.map((score, index) => (
                  <div key={`conf-score-${numbersToDisplay[index]}-idx-${index}`} className="p-2 border rounded-md bg-muted/50 text-sm">
                    <span className="font-medium">{numbersToDisplay[index] ?? 'N/A'}:</span> {(score * 100).toFixed(1)}%
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {isModelOutputType && modelPrediction && <div className="mt-4">{renderModelPredictionDetails(modelPrediction)}</div>}
          
          {!isModelOutputType && mainExplanation && (
            <div>
              <h4 className="font-semibold mb-2 mt-4 text-primary flex items-center"><Lightbulb className="w-4 h-4 mr-2" /> Explication IA (Stratégie):</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md whitespace-pre-line">{mainExplanation}</p>
            </div>
          )}
           {numbersToDisplay.length === 0 && isModelOutputType && (
             <p className="text-sm text-muted-foreground mt-4">Aucun numéro final prédit à afficher, mais l'analyse des modèles simulés et l'explication sont disponibles ci-dessus.</p>
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
                <Alert variant="destructive">
                    <AlertTriangle className="w-5 h-5" />
                    <AlertTitle>Erreur de Prédiction</AlertTitle>
                    <UiAlertDescription>{error}</UiAlertDescription>
                </Alert>
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
          <TabsTrigger value="model"><FileText className="w-4 h-4 mr-2" />Stratégie Complexe IA</TabsTrigger>
          <TabsTrigger value="strategy"><Wand2 className="w-4 h-4 mr-2" />Stratégie Personnalisée</TabsTrigger>
          <TabsTrigger value="confidence-checker"><CheckSquare className="w-4 h-4 mr-2" />Vérifier Confiance</TabsTrigger>
        </TabsList>
      </CardHeader>

      <TabsContent value="model">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Prédire avec la Stratégie Complexe et Analyse IA</CardTitle>
            <CardDescription>
              Fournissez les informations nécessaires pour que l'IA (Gemini) simule les analyses DBN, LightGBM, Clustering, et un ensemble pondéré pour {pageDrawName}.
            </CardDescription>
          </CardHeader>
          <Form {...modelPredictionForm}>
            <form onSubmit={modelPredictionForm.handleSubmit(onModelPredictionSubmit)}>
              <CardContent className="space-y-4">
                {/* REMOVED lastWinningNumbersString and constantToAddString fields */}
                <FormField
                  control={modelPredictionForm.control}
                  name="maxLotteryNumberString"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Numéro Max. Loterie</FormLabel>
                      <FormControl><Input type="number" placeholder="Ex: 90" {...field} /></FormControl>
                      <FormMessage />
                      </FormItem>
                  )}
                />
                <FormField
                  control={modelPredictionForm.control}
                  name="historicalData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Données Historiques des Tirages ({pageDrawName}) (pour simulation IA)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder={`Entrez les résultats passés pour ${pageDrawName}, ex: 'Date: 2023-01-01, Gagnants: 1,2,3,4,5; ...'`}
                          className="min-h-[120px] text-sm"
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
                  Générer la Prédiction avec Stratégie IA
                </Button>
              </CardFooter>
            </form>
          </Form>
          {isLoadingModel && <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {!isLoadingModel && renderPredictionOutput(modelPrediction, "Résultat de la Stratégie Complexe IA")}
        </Card>
      </TabsContent>

      <TabsContent value="strategy">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-base">Prédire basé sur Votre Stratégie Personnalisée</CardTitle>
            <CardDescription>
              Décrivez votre propre stratégie de sélection de numéros de loterie pour {pageDrawName}. L'IA interprétera votre stratégie et générera des numéros en conséquence.
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
                  Générer la Prédiction avec Votre Stratégie
                </Button>
              </CardFooter>
            </form>
          </Form>
          {isLoadingStrategy && <div className="p-6 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}
          {!isLoadingStrategy && renderPredictionOutput(strategyPrediction, "Prédiction Basée sur Votre Stratégie")}
        </Card>
      </TabsContent>

      <TabsContent value="confidence-checker">
        <ConfidenceCheckerTab pageDrawName={pageDrawName} />
      </TabsContent>
    </Tabs>
  );
}
// Minor adjustment for build re-evaluation.
// Another comment to ensure this file is processed cleanly by the build system.
// Removed table generation logic from this component as well.
// Simplified form for model prediction.
// Adjusted rendering logic for prediction output.

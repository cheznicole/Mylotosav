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
import { Loader2, Wand2, FileText } from 'lucide-react';
import type { AIPrediction, StrategyPrediction, LotteryResult } from '@/types';
import { predictLottoNumbersWithStrategy } from '@/ai/flows/prompt-for-lotto-strategy';
import { generateLottoPredictions } from '@/ai/flows/generate-lotto-predictions';
import { fetchLotteryResults, getPastResultsStringForAI } from '@/lib/mockApi'; // To prepopulate past results

// Schemas for forms
const PastResultsFormSchema = z.object({
  pastResults: z.string().min(10, { message: "Please provide some past results." }),
});
type PastResultsFormData = z.infer<typeof PastResultsFormSchema>;

const StrategyFormSchema = z.object({
  strategyPrompt: z.string().min(10, { message: "Please describe your strategy." }),
});
type StrategyFormData = z.infer<typeof StrategyFormSchema>;


export default function PredictionEngine() {
  const { toast } = useToast();
  const [isLoadingModel, setIsLoadingModel] = useState(false);
  const [modelPrediction, setModelPrediction] = useState<AIPrediction | null>(null);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [strategyPrediction, setStrategyPrediction] = useState<StrategyPrediction | null>(null);
  const [initialPastResults, setInitialPastResults] = useState("");

  useEffect(() => {
    async function loadInitialResults() {
      try {
        const results = await fetchLotteryResults();
        setInitialPastResults(getPastResultsStringForAI(results));
      } catch (error) {
        console.error("Failed to load initial past results for AI", error);
        // Set a generic placeholder if fetch fails
        setInitialPastResults("Example: Date: 2024-07-20, Winning: 5, 12, 23, 34, 45, Machine: 1, 7; ...");
      }
    }
    loadInitialResults();
  }, []);
  
  useEffect(() => {
    if (initialPastResults && pastResultsForm.getValues("pastResults") === "") {
       pastResultsForm.reset({ pastResults: initialPastResults });
    }
  }, [initialPastResults]);


  const pastResultsForm = useForm<PastResultsFormData>({
    resolver: zodResolver(PastResultsFormSchema),
    defaultValues: { pastResults: "" },
  });

  const strategyForm = useForm<StrategyFormData>({
    resolver: zodResolver(StrategyFormSchema),
    defaultValues: { strategyPrompt: "" },
  });

  const onPastResultsSubmit: SubmitHandler<PastResultsFormData> = async (data) => {
    setIsLoadingModel(true);
    setModelPrediction(null);
    try {
      const result = await generateLottoPredictions({ pastResults: data.pastResults });
      setModelPrediction(result);
      toast({ title: "Prediction Generated", description: "Model-based prediction successful." });
    } catch (error) {
      console.error("Error generating model prediction:", error);
      toast({ variant: "destructive", title: "Prediction Error", description: "Could not generate model-based prediction." });
    } finally {
      setIsLoadingModel(false);
    }
  };

  const onStrategySubmit: SubmitHandler<StrategyFormData> = async (data) => {
    setIsLoadingStrategy(true);
    setStrategyPrediction(null);
    try {
      const result = await predictLottoNumbersWithStrategy({ strategyPrompt: data.strategyPrompt });
      setStrategyPrediction(result);
      toast({ title: "Prediction Generated", description: "Strategy-based prediction successful." });
    } catch (error) {
      console.error("Error generating strategy prediction:", error);
      toast({ variant: "destructive", title: "Prediction Error", description: "Could not generate strategy-based prediction." });
    } finally {
      setIsLoadingStrategy(false);
    }
  };

  const renderPrediction = (prediction: AIPrediction | StrategyPrediction | null, title: string, analysis?: string) => {
    if (!prediction) return null;
    return (
      <Card className="mt-6 shadow-md">
        <CardHeader>
          <CardTitle className="text-xl text-primary">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h4 className="font-semibold mb-2">Predicted Numbers:</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.predictedNumbers.map((num, index) => (
                <LotteryNumberDisplay key={`${num}-${index}`} number={num} />
              ))}
            </div>
          </div>
          <div>
            <h4 className="font-semibold mb-2">Confidence Scores:</h4>
            <div className="flex flex-wrap gap-2">
              {prediction.confidenceScores.map((score, index) => (
                <div key={`conf-${index}`} className="p-2 border rounded-md bg-muted/50 text-sm">
                  <span className="font-medium">{prediction.predictedNumbers[index]}:</span> {(score * 100).toFixed(1)}%
                </div>
              ))}
            </div>
          </div>
          {analysis && (
            <div>
              <h4 className="font-semibold mb-2">Analysis:</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/30 rounded-md">{analysis}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <Tabs defaultValue="model" className="w-full">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl font-bold text-primary mb-2">AI Predictions</CardTitle>
        <CardDescription>
            Generate lottery predictions using AI. Choose your method below.
        </CardDescription>
        <TabsList className="grid w-full grid-cols-2 mt-4">
          <TabsTrigger value="model"><FileText className="w-4 h-4 mr-2" />Past Results Model</TabsTrigger>
          <TabsTrigger value="strategy"><Wand2 className="w-4 h-4 mr-2" />Custom Strategy</TabsTrigger>
        </TabsList>
      </CardHeader>

      <TabsContent value="model">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Predict based on Past Results</CardTitle>
            <CardDescription>
              Input past lottery results data. The AI will use its pre-trained model (e.g., XGBoost + RNN-LSTM) to find patterns and predict future numbers.
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
                      <FormLabel>Past Lottery Results Data</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Enter past results, e.g., 'Date: 2023-01-01, Winning: 1,2,3,4,5, Machine: 6,7; Date: 2023-01-08, ...'"
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
                  Generate Prediction
                </Button>
              </CardFooter>
            </form>
          </Form>
          {renderPrediction(modelPrediction, "Model-Based Prediction", modelPrediction?.analysis)}
        </Card>
      </TabsContent>

      <TabsContent value="strategy">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Predict based on Your Strategy</CardTitle>
            <CardDescription>
              Describe your lottery number selection strategy. The AI will interpret your strategy and generate numbers accordingly.
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
                      <FormLabel>Your Lottery Strategy</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="e.g., 'Focus on numbers that haven't appeared in the last 10 draws, and include at least two prime numbers.'"
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
                  Generate Prediction with Strategy
                </Button>
              </CardFooter>
            </form>
          </Form>
          {renderPrediction(strategyPrediction, "Strategy-Based Prediction")}
        </Card>
      </TabsContent>
    </Tabs>
  );
}

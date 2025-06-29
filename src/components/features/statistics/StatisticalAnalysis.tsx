
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { NumberFrequency, NumberGap } from '@/types';
import { fetchLotteryResults, analyzeFrequencies, analyzeGaps, type DrawResult as ApiDrawResult } from '@/services/lotteryApi';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, TrendingUp, TrendingDown, Hourglass } from "lucide-react";
import { formatDistanceToNow, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';


const CHART_ITEMS_COUNT = 15;

interface StatisticalAnalysisProps {
  specificDrawName: string; // Expecting the specific draw name from the parent page
}

export default function StatisticalAnalysis({ specificDrawName }: StatisticalAnalysisProps) {
  const [allFetchedResults, setAllFetchedResults] = useState<ApiDrawResult[]>([]);
  const [frequencies, setFrequencies] = useState<NumberFrequency[]>([]);
  const [gaps, setGaps] = useState<NumberGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    const loadResults = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchLotteryResults();
        setAllFetchedResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lottery results.');
        setAllFetchedResults([]);
        setFrequencies([]);
        setGaps([]);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadResults();
  }, []); 


  useEffect(() => {
    if (!allFetchedResults || !specificDrawName) return;

    const filteredByDrawName = allFetchedResults.filter(result => result.draw_name === specificDrawName);

    if (filteredByDrawName.length === 0 && allFetchedResults.length > 0) {
       setFrequencies([]);
       setGaps([]);
       return;
    }
    
    const rawFrequencies = analyzeFrequencies(filteredByDrawName);
    const formattedFrequencies: NumberFrequency[] = Object.entries(rawFrequencies)
      .map(([numStr, freq]) => ({
        number: parseInt(numStr, 10),
        frequency: freq,
      }))
      .sort((a, b) => b.number - a.number); 
    setFrequencies(formattedFrequencies);

    const gapData = analyzeGaps(filteredByDrawName);
    setGaps(gapData);

  }, [allFetchedResults, specificDrawName]);


  const mostFrequent = useMemo(() => 
    [...frequencies].sort((a, b) => b.frequency - a.frequency).slice(0, CHART_ITEMS_COUNT),
    [frequencies]
  );
  const leastFrequent = useMemo(() =>
    [...frequencies].sort((a, b) => a.frequency - b.frequency).slice(0, CHART_ITEMS_COUNT),
    [frequencies]
  );
  const mostOverdue = useMemo(() =>
    [...gaps].sort((a, b) => b.gap - a.gap).slice(0, CHART_ITEMS_COUNT),
    [gaps]
  );

  if (error && !loading) {
     return (
       <Card>
        <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Statistiques des Numéros</CardTitle>
            <CardDescription>Analyse fréquentielle pour {specificDrawName}.</CardDescription>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive">
                <Terminal className="h-4 w-4" />
                <AlertTitle>Erreur</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
            </Alert>
        </CardContent>
       </Card>
    );
  }
  
  const renderChart = (data: NumberFrequency[], title: string) => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data.sort((a,b) => a.number - b.number)} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="number" stroke="hsl(var(--foreground))" fontSize={12} />
        <YAxis stroke="hsl(var(--foreground))" allowDecimals={false} fontSize={12}/>
        <Tooltip
          contentStyle={{ 
            backgroundColor: 'hsl(var(--popover))', 
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)',
            color: 'hsl(var(--popover-foreground))'
          }}
          cursor={{ fill: 'hsla(var(--muted), 0.5)' }}
        />
        <Legend wrapperStyle={{ color: 'hsl(var(--foreground))' }} />
        <Bar dataKey="frequency" fill="hsl(var(--primary))" name={title} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  const noDataForFilters = !loading && frequencies.length === 0 && allFetchedResults.length > 0;

  return (
    <Tabs defaultValue="mostFrequent" className="w-full">
      <CardHeader className="px-0">
        <CardTitle className="text-xl font-semibold text-primary">Statistiques des Numéros</CardTitle>
        <CardDescription>
          Analyse de la fréquence et des écarts des numéros pour le tirage: {specificDrawName}.
        </CardDescription>
         <TabsList className="grid w-full grid-cols-3 md:w-1/2 mt-6">
          <TabsTrigger value="mostFrequent"><TrendingUp className="w-4 h-4 mr-2"/>Plus Fréquents</TabsTrigger>
          <TabsTrigger value="leastFrequent"><TrendingDown className="w-4 h-4 mr-2"/>Moins Fréquents</TabsTrigger>
          <TabsTrigger value="gaps"><Hourglass className="w-4 h-4 mr-2"/>Écarts</TabsTrigger>
        </TabsList>
      </CardHeader>
     
      {loading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="h-[400px] w-full" />
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
            {Array.from({length: CHART_ITEMS_COUNT}).map((_, idx) => <Skeleton key={idx} className="h-10 w-10 rounded-full" />)}
          </div>
        </div>
      ) : noDataForFilters || frequencies.length === 0 ? (
         <Alert className="mt-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>Données Insuffisantes</AlertTitle>
            <AlertDescription>Pas assez de données pour afficher les statistiques pour {specificDrawName}.</AlertDescription>
        </Alert>
      ) : (
        <>
          <TabsContent value="mostFrequent">
            <Card className="shadow-lg mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Top {CHART_ITEMS_COUNT} Numéros les Plus Fréquents</CardTitle>
              </CardHeader>
              <CardContent>
                {renderChart(mostFrequent, "Fréquence (Plus Fréquents)")}
                <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {mostFrequent.map(item => <LotteryNumberDisplay key={`most-${item.number}`} number={item.number} />)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="leastFrequent">
            <Card className="shadow-lg mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Top {CHART_ITEMS_COUNT} Numéros les Moins Fréquents</CardTitle>
              </CardHeader>
              <CardContent>
                 {renderChart(leastFrequent, "Fréquence (Moins Fréquents)")}
                 <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {leastFrequent.map(item => <LotteryNumberDisplay key={`least-${item.number}`} number={item.number} />)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="gaps">
             <Card className="shadow-lg mt-4">
              <CardHeader>
                <CardTitle className="text-lg">Top {CHART_ITEMS_COUNT} Numéros les Plus en Retard (Écart le Plus Grand)</CardTitle>
                <CardDescription>
                  L'écart représente le nombre de tirages pour "{specificDrawName}" depuis la dernière apparition d'un numéro.
                </CardDescription>
              </CardHeader>
              <CardContent>
                 <ul className="space-y-3">
                    {mostOverdue.map(item => (
                       <li key={`gap-${item.number}`} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                          <div className="flex items-center gap-4">
                             <LotteryNumberDisplay number={item.number} size="md" />
                             <div>
                                <p className="font-semibold">Écart: {item.gap} tirages</p>
                                <p className="text-xs text-muted-foreground">
                                  Dernière apparition: {item.lastSeenDate ? `il y a ${formatDistanceToNow(parseISO(item.lastSeenDate), { locale: fr })}` : 'Jamais (dans cet historique)'}
                                </p>
                             </div>
                          </div>
                       </li>
                    ))}
                 </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}


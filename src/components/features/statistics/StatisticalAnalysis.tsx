"use client";

import { useEffect, useState } from 'react';
import type { NumberFrequency } from '@/types';
import { fetchNumberFrequencies } from '@/lib/mockApi';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

const CHART_ITEMS_COUNT = 15;

export default function StatisticalAnalysis() {
  const [frequencies, setFrequencies] = useState<NumberFrequency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFrequencies = async () => {
      try {
        setLoading(true);
        const data = await fetchNumberFrequencies();
        setFrequencies(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch number frequencies.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadFrequencies();
  }, []);

  const mostFrequent = [...frequencies].sort((a, b) => b.frequency - a.frequency).slice(0, CHART_ITEMS_COUNT);
  const leastFrequent = [...frequencies].sort((a, b) => a.frequency - b.frequency).slice(0, CHART_ITEMS_COUNT);

  if (error) {
    return (
       <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  
  const renderChart = (data: NumberFrequency[], title: string) => (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="number" stroke="hsl(var(--foreground))" />
        <YAxis stroke="hsl(var(--foreground))" />
        <Tooltip
          contentStyle={{ 
            backgroundColor: 'hsl(var(--background))', 
            borderColor: 'hsl(var(--border))',
            borderRadius: 'var(--radius)' 
          }}
          cursor={{ fill: 'hsl(var(--muted))' }}
        />
        <Legend />
        <Bar dataKey="frequency" fill="hsl(var(--primary))" name={title} radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <Tabs defaultValue="mostFrequent" className="w-full">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl font-bold text-primary">Number Statistics</CardTitle>
         <TabsList className="grid w-full grid-cols-2 md:w-1/2 mt-2">
          <TabsTrigger value="mostFrequent">Most Frequent</TabsTrigger>
          <TabsTrigger value="leastFrequent">Least Frequent</TabsTrigger>
        </TabsList>
      </CardHeader>
     
      <TabsContent value="mostFrequent">
        <Card className="shadow-lg mt-4">
          <CardHeader>
            <CardTitle className="text-xl">Top {CHART_ITEMS_COUNT} Most Frequent Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
              renderChart(mostFrequent, "Frequency (Most Frequent)")
            )}
            <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
              {loading ? 
                Array.from({length: CHART_ITEMS_COUNT}).map((_, idx) => <Skeleton key={idx} className="h-10 w-10 rounded-full" />) :
                mostFrequent.map(item => <LotteryNumberDisplay key={item.number} number={item.number} />)
              }
            </div>
          </CardContent>
        </Card>
      </TabsContent>
      <TabsContent value="leastFrequent">
        <Card className="shadow-lg mt-4">
          <CardHeader>
            <CardTitle className="text-xl">Top {CHART_ITEMS_COUNT} Least Frequent Numbers</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[400px] w-full" />
            ) : (
               renderChart(leastFrequent, "Frequency (Least Frequent)")
            )}
             <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
              {loading ? 
                Array.from({length: CHART_ITEMS_COUNT}).map((_, idx) => <Skeleton key={idx} className="h-10 w-10 rounded-full" />) :
                leastFrequent.map(item => <LotteryNumberDisplay key={item.number} number={item.number} />)
              }
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}

"use client";

import { useEffect, useState, useMemo } from 'react';
import type { CooccurrenceData } from '@/types'; // Keep this if it's still relevant for structure
import type { DrawResult as ApiDrawResult } from '@/services/lotteryApi';
import { fetchLotteryResults } from '@/services/lotteryApi'; // Fetch from actual API
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

interface CooccurrenceMatrixProps {
  drawName: string;
}

// Helper to calculate co-occurrence from raw results for a specific drawName
function calculateCooccurrenceForDraw(results: ApiDrawResult[], targetDrawName: string): CooccurrenceData[] {
  const drawSpecificResults = results.filter(r => r.draw_name === targetDrawName);
  if (drawSpecificResults.length === 0) return [];

  const numberCounts: { [num: number]: number } = {};
  const cooccurrenceMap: { [num1: number]: { [num2: number]: number } } = {};

  drawSpecificResults.forEach(result => {
    result.gagnants.forEach(num => {
      numberCounts[num] = (numberCounts[num] || 0) + 1;
    });

    for (let i = 0; i < result.gagnants.length; i++) {
      for (let j = i + 1; j < result.gagnants.length; j++) {
        const num1 = result.gagnants[i];
        const num2 = result.gagnants[j];

        cooccurrenceMap[num1] = cooccurrenceMap[num1] || {};
        cooccurrenceMap[num1][num2] = (cooccurrenceMap[num1][num2] || 0) + 1;

        cooccurrenceMap[num2] = cooccurrenceMap[num2] || {};
        cooccurrenceMap[num2][num1] = (cooccurrenceMap[num2][num1] || 0) + 1;
      }
    }
  });
  
  const sortedNumbersByFrequency = Object.entries(numberCounts)
    .sort(([, freqA], [, freqB]) => freqB - freqA)
    .map(([numStr]) => parseInt(numStr));

  const output: CooccurrenceData[] = [];
  // Show co-occurrence for top N most frequent numbers for this draw
  const topN = 15; 

  for (const num of sortedNumbersByFrequency.slice(0, topN)) {
    if (cooccurrenceMap[num]) {
      const cooccurringNumbers = Object.entries(cooccurrenceMap[num])
        .map(([coNumStr, freq]) => ({
          number: parseInt(coNumStr),
          frequency: freq,
        }))
        .sort((a, b) => b.frequency - a.frequency)
        .slice(0, 5); // Show top 5 co-occurring for each number

      if (cooccurringNumbers.length > 0) {
        output.push({
          number: num,
          cooccurringNumbers,
        });
      }
    }
  }
  return output.sort((a,b) => (numberCounts[b.number] || 0) - (numberCounts[a.number] || 0) );
}


export default function CooccurrenceMatrix({ drawName }: CooccurrenceMatrixProps) {
  const [allResults, setAllResults] = useState<ApiDrawResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLotteryResults(); // Fetch all results
        setAllResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch co-occurrence data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  const cooccurrenceForThisDraw = useMemo(() => {
    if (!drawName || allResults.length === 0) return [];
    return calculateCooccurrenceForDraw(allResults, drawName);
  }, [allResults, drawName]);


  if (error) {
     return (
       <Card>
        <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Consulter les Régularités</CardTitle>
            <CardDescription>Fréquence d'apparition des numéros ensemble pour {drawName}.</CardDescription>
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

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-primary">Consulter les Régularités</CardTitle>
        <CardDescription>
          Fréquence d'apparition d'un numéro avec d'autres numéros dans le même tirage pour: {drawName}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : cooccurrenceForThisDraw.length === 0 ? (
             <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Données Insuffisantes</AlertTitle>
                <AlertDescription>Pas assez de données pour calculer les co-occurrences pour {drawName}.</AlertDescription>
            </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Numéro</TableHead>
                <TableHead>Apparaît Souvent Avec (Fréquence)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cooccurrenceForThisDraw.map((item) => (
                <TableRow key={item.number}>
                  <TableCell>
                    <LotteryNumberDisplay number={item.number} size="md" />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2 items-center">
                      {item.cooccurringNumbers.map(co => (
                        <div key={co.number} className="flex items-center gap-1 p-1 border rounded-md bg-muted/50">
                          <LotteryNumberDisplay number={co.number} size="sm" />
                          <span className="text-xs text-muted-foreground">({co.frequency})</span>
                        </div>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

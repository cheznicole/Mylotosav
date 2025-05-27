// src/app/draw/[drawSlug]/page.tsx
"use client";

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getDrawNameBySlug } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, BarChart3, Cpu, FileText, Network, Lightbulb } from 'lucide-react'; // Added Lightbulb for Prédiction Intelligente

// Dynamically import feature components
import dynamic from 'next/dynamic';

const ResultsDisplay = dynamic(() => import('@/components/features/results/ResultsDisplay'), {
  loading: () => <Skeleton className="h-[300px] w-full" />,
});
const CooccurrenceMatrix = dynamic(() => import('@/components/features/cooccurrence/CooccurrenceMatrix'), {
  loading: () => <Skeleton className="h-[300px] w-full" />,
});
const StatisticalAnalysis = dynamic(() => import('@/components/features/statistics/StatisticalAnalysis'), {
  loading: () => <Skeleton className="h-[400px] w-full" />,
});
const PredictionEngine = dynamic(() => import('@/components/features/predict/PredictionEngine'), {
  loading: () => <Skeleton className="h-[400px] w-full" />,
});


export default function DrawCategoryPage() {
  const params = useParams();
  const drawSlug = typeof params.drawSlug === 'string' ? params.drawSlug : '';
  const [drawName, setDrawName] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (drawSlug) {
      const name = getDrawNameBySlug(drawSlug);
      setDrawName(name);
    }
    setIsLoading(false);
  }, [drawSlug]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!drawName) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-destructive flex items-center">
            <AlertTriangle className="w-6 h-6 mr-2" /> Invalid Draw Category
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p>The draw category specified in the URL could not be found.</p>
          <p>Please select a valid draw from the sidebar.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <CardHeader className="px-0 pb-2">
        <CardTitle className="text-3xl font-bold text-primary">{drawName}</CardTitle>
        <CardDescription>
          Explorez les données, statistiques et prédictions intelligentes pour le tirage {drawName}.
        </CardDescription>
      </CardHeader>

      <Tabs defaultValue="donnees" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
          <TabsTrigger value="donnees"><FileText className="w-4 h-4 mr-2" />Données</TabsTrigger>
          <TabsTrigger value="consulter"><Network className="w-4 h-4 mr-2" />Consulter</TabsTrigger>
          <TabsTrigger value="statistiques"><BarChart3 className="w-4 h-4 mr-2" />Statistiques</TabsTrigger>
          <TabsTrigger value="prediction-intelligente"><Lightbulb className="w-4 h-4 mr-2" />Prédiction Intelligente</TabsTrigger>
        </TabsList>

        <TabsContent value="donnees">
          <ResultsDisplay drawName={drawName} />
        </TabsContent>
        <TabsContent value="consulter">
          <CooccurrenceMatrix drawName={drawName} />
        </TabsContent>
        <TabsContent value="statistiques">
          <StatisticalAnalysis specificDrawName={drawName} />
        </TabsContent>
        <TabsContent value="prediction-intelligente">
          <PredictionEngine drawName={drawName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

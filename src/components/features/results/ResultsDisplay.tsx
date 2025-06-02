
"use client";

import { useEffect, useState } from 'react';
import type { DrawResult as ApiDrawResult } from '@/services/lotteryApi';
import { fetchLotteryResults } from '@/services/lotteryApi';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal, CalendarDays } from "lucide-react";
import { parseISO, format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ITEMS_PER_PAGE = 5; // Adjusted for card layout

interface ResultsDisplayProps {
  drawName: string;
}

export default function ResultsDisplay({ drawName }: ResultsDisplayProps) {
  const [allResults, setAllResults] = useState<ApiDrawResult[]>([]);
  const [filteredResults, setFilteredResults] = useState<ApiDrawResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchLotteryResults();
        setAllResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lottery results.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadResults();
  }, []);

  useEffect(() => {
    if (drawName && allResults.length > 0) {
      const relevantResults = allResults
        .filter(result => result.draw_name === drawName)
        .sort((a, b) => parseISO(b.date).getTime() - parseISO(a.date).getTime()); // Sort by date descending
      setFilteredResults(relevantResults);
      setCurrentPage(1);
    } else {
      setFilteredResults([]);
    }
  }, [drawName, allResults]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const formatDate = (dateString: string): string => {
    try {
      const date = parseISO(dateString);
      return format(date, 'EEEE d MMMM yyyy', { locale: fr });
    } catch (e) {
      console.error("Error formatting date:", dateString, e);
      return dateString; // fallback to original string
    }
  };

  if (error) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle className="text-xl font-semibold text-primary">Résultats des Tirages</CardTitle>
            <CardDescription>Affichage des résultats pour {drawName}.</CardDescription>
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
        <CardTitle className="text-xl font-semibold text-primary">Résultats des Tirages</CardTitle>
         <CardDescription>Historique des résultats pour le tirage: {drawName}.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
              <Card key={`skeleton-${i}`} className="p-4">
                <Skeleton className="h-6 w-1/2 mb-4" />
                <Skeleton className="h-4 w-1/3 mb-2" />
                <div className="flex gap-2 mb-4">
                  {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-10 w-10 rounded-full" />)}
                </div>
                <Skeleton className="h-4 w-1/3 mb-2" />
                <div className="flex gap-2">
                  {[...Array(5)].map((_, j) => <Skeleton key={j} className="h-10 w-10 rounded-full" />)}
                </div>
              </Card>
            ))}
          </div>
        ) : paginatedResults.length === 0 ? (
            <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Aucun Résultat</AlertTitle>
                <AlertDescription>Aucun résultat trouvé pour {drawName}.</AlertDescription>
            </Alert>
        ) : (
          <div className="space-y-4">
            {paginatedResults.map((result) => ( 
              <Card key={result.id} className="overflow-hidden">
                <CardHeader className="bg-muted/30 p-4">
                  <CardTitle className="text-base font-medium flex items-center">
                    <CalendarDays className="w-4 h-4 mr-2 text-primary" />
                    {formatDate(result.date)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2">Numéros Gagnants</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.gagnants.map((num, numIndex) => (
                        <LotteryNumberDisplay key={`gagnant-${result.id}-${num}-${numIndex}`} number={num} size="md" />
                      ))}
                    </div>
                  </div>
                  {result.machine && result.machine.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Numéros Machine</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.machine.map((num, numIndex) => (
                          <LotteryNumberDisplay key={`machine-${result.id}-${num}-${numIndex}`} number={num} size="md" className="opacity-90" />
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
      {!loading && filteredResults.length > 0 && totalPages > 1 && (
        <CardFooter className="flex justify-between items-center pt-6 border-t mt-4">
          <Button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            variant="outline"
          >
            Précédent
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} sur {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Suivant
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

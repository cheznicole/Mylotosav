
"use client";

import { useEffect, useState } from 'react';
import type { DrawResult as ApiDrawResult } from '@/services/lotteryApi'; // Use type from actual API
import { fetchLotteryResults } from '@/services/lotteryApi'; // Fetch from actual API
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

const ITEMS_PER_PAGE = 10;

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
        // Fetch all results for the default period (e.g., current month or all available)
        // The API might need a way to fetch all, or we fetch month by month.
        // For now, assuming fetchLotteryResults() gets a reasonable default set.
        const data = await fetchLotteryResults(); // Consider passing a date range or month if API supports
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
      const relevantResults = allResults.filter(result => result.draw_name === drawName);
      setFilteredResults(relevantResults);
      setCurrentPage(1); // Reset to first page when drawName or allResults change
    } else {
      setFilteredResults([]);
    }
  }, [drawName, allResults]);

  const totalPages = Math.ceil(filteredResults.length / ITEMS_PER_PAGE);
  const paginatedResults = filteredResults.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (error) {
    return (
      <Card>
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
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : paginatedResults.length === 0 ? (
            <Alert>
                <Terminal className="h-4 w-4" />
                <AlertTitle>Aucun Résultat</AlertTitle>
                <AlertDescription>Aucun résultat trouvé pour {drawName} pour la période sélectionnée.</AlertDescription>
            </Alert>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Numéros Gagnants</TableHead>
                <TableHead>Numéros Machine</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedResults.map((result, index) => ( 
                <TableRow key={`${result.id}-${index}`}>
                  <TableCell>{new Date(result.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {result.gagnants.map((num, numIndex) => (
                        <LotteryNumberDisplay key={`gagnant-${result.id}-${num}-${numIndex}`} number={num} size="sm" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {result.machine && result.machine.map((num, numIndex) => (
                        <LotteryNumberDisplay key={`machine-${result.id}-${num}-${numIndex}`} number={num} size="sm" className="opacity-75" />
                      ))}
                      {!result.machine && <span className="text-xs text-muted-foreground">N/A</span>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {!loading && filteredResults.length > 0 && totalPages > 1 && (
        <CardFooter className="flex justify-between items-center pt-4">
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

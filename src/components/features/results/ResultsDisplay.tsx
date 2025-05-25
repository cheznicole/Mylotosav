"use client";

import { useEffect, useState } from 'react';
import type { LotteryResult } from '@/types';
import { fetchLotteryResults } from '@/lib/mockApi';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

const ITEMS_PER_PAGE = 5;

export default function ResultsDisplay() {
  const [results, setResults] = useState<LotteryResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        const data = await fetchLotteryResults();
        setResults(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch lottery results.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadResults();
  }, []);

  const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
  const paginatedResults = results.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  if (error) {
    return (
      <Alert variant="destructive">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-primary">Lottery Results</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-4">
            {[...Array(ITEMS_PER_PAGE)].map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Winning Numbers</TableHead>
                <TableHead>Machine Numbers</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedResults.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{new Date(result.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {result.winningNumbers.map((num) => (
                        <LotteryNumberDisplay key={num} number={num} size="sm" />
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex space-x-2">
                      {result.machineNumbers.map((num) => (
                        <LotteryNumberDisplay key={num} number={num} size="sm" className="bg-gray-400" />
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      {!loading && totalPages > 1 && (
        <CardFooter className="flex justify-between items-center pt-4">
          <Button
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            variant="outline"
          >
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            variant="outline"
          >
            Next
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

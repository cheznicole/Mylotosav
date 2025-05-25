"use client";

import { useEffect, useState } from 'react';
import type { CooccurrenceData } from '@/types';
import { fetchCooccurrenceData } from '@/lib/mockApi';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Terminal } from "lucide-react";

export default function CooccurrenceMatrix() {
  const [cooccurrence, setCooccurrence] = useState<CooccurrenceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const data = await fetchCooccurrenceData();
        setCooccurrence(data);
        setError(null);
      } catch (err) {
        setError('Failed to fetch co-occurrence data.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

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
        <CardTitle className="text-2xl font-bold text-primary">Co-occurrence Matrix</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground mb-4">
          Frequency of each number appearing with other numbers. Showing top co-occurrences.
        </p>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Often Appears With (Frequency)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cooccurrence.map((item) => (
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

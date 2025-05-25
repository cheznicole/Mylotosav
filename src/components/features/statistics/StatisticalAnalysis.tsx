
"use client";

import { useEffect, useState, useMemo } from 'react';
import type { NumberFrequency } from '@/types';
import { fetchLotteryResults, analyzeFrequencies, DRAW_SCHEDULE, type DrawResult as ApiDrawResult } from '@/services/lotteryApi';
import LotteryNumberDisplay from '@/components/features/lottery/LotteryNumberDisplay';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Terminal, CalendarDays, ListFilter } from "lucide-react";

const CHART_ITEMS_COUNT = 15;

// Helper to generate recent months for the filter
function getRecentMonths(count: number): { value: string; label: string }[] {
  const months = [];
  const today = new Date();
  for (let i = 0; i < count; i++) {
    const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const monthName = date.toLocaleString('fr-FR', { month: 'long' }); // Use French month names
    months.push({ value: `${year}-${month}`, label: `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${year}` });
  }
  return months;
}

// Helper to get unique draw names from the schedule
function getUniqueDrawNames(schedule: typeof DRAW_SCHEDULE): string[] {
  const names = new Set<string>();
  Object.values(schedule).forEach(daySchedule => {
    Object.values(daySchedule).forEach(name => names.add(name));
  });
  return Array.from(names).sort();
}


export default function StatisticalAnalysis() {
  const [allFetchedResults, setAllFetchedResults] = useState<ApiDrawResult[]>([]);
  const [frequencies, setFrequencies] = useState<NumberFrequency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const availableMonths = useMemo(() => getRecentMonths(6), []); // Last 6 months
  const allDrawNames = useMemo(() => getUniqueDrawNames(DRAW_SCHEDULE), []);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => availableMonths[0]?.value || "");
  const [selectedDrawName, setSelectedDrawName] = useState<string>("all");


  useEffect(() => {
    if (!selectedMonth) return;

    const loadResultsForMonth = async () => {
      setLoading(true);
      setError(null);
      try {
        // The API month format is not specified, assuming YYYY-MM might work or it might fetch all.
        // For LotoBonheur, month might be like "07-2024" or just "07".
        // Let's try with YYYY-MM as it's a common standard.
        // The actual API call `https://lotobonheur.ci/api/results?month=${month}` needs to be checked for its expected format.
        // For now, `fetchLotteryResults` in `services/lotteryApi.ts` uses the `month` param in the URL.
        const data = await fetchLotteryResults(selectedMonth);
        setAllFetchedResults(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch lottery results.');
        setAllFetchedResults([]); // Clear previous results on error
        setFrequencies([]);
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadResultsForMonth();
  }, [selectedMonth]);


  useEffect(() => {
    if (!allFetchedResults) return;

    let filteredByDrawName = allFetchedResults;
    if (selectedDrawName !== "all") {
      filteredByDrawName = allFetchedResults.filter(result => result.draw_name === selectedDrawName);
    }

    if (filteredByDrawName.length === 0 && allFetchedResults.length > 0) {
       setFrequencies([]); // Show no data if filter results in empty, but we had initial data
       return;
    }
     if (filteredByDrawName.length === 0 && selectedDrawName !== "all") {
      setFrequencies([]); // No data for this specific draw name
      return;
    }


    const rawFrequencies = analyzeFrequencies(filteredByDrawName);
    const formattedFrequencies: NumberFrequency[] = Object.entries(rawFrequencies)
      .map(([numStr, freq]) => ({
        number: parseInt(numStr, 10),
        frequency: freq,
      }))
      .sort((a, b) => b.number - a.number); // Sort by number for consistent chart X-axis
    
    setFrequencies(formattedFrequencies);

  }, [allFetchedResults, selectedDrawName]);


  const mostFrequent = useMemo(() => 
    [...frequencies].sort((a, b) => b.frequency - a.frequency).slice(0, CHART_ITEMS_COUNT),
    [frequencies]
  );
  const leastFrequent = useMemo(() =>
    [...frequencies].sort((a, b) => a.frequency - b.frequency).slice(0, CHART_ITEMS_COUNT),
    [frequencies]
  );

  if (error && !loading) { // Only show error if not loading new data
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
      <BarChart data={data.sort((a,b) => a.number - b.number)} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis dataKey="number" stroke="hsl(var(--foreground))" />
        <YAxis stroke="hsl(var(--foreground))" allowDecimals={false}/>
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

  const noDataForFilters = !loading && frequencies.length === 0 && allFetchedResults.length > 0;

  return (
    <Tabs defaultValue="mostFrequent" className="w-full">
      <CardHeader className="px-0">
        <CardTitle className="text-2xl font-bold text-primary">Number Statistics</CardTitle>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
          <div>
            <Label htmlFor="month-select" className="flex items-center mb-1 text-sm font-medium text-muted-foreground">
              <CalendarDays className="w-4 h-4 mr-2"/>
              Select Month
            </Label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger id="month-select" className="w-full md:w-[200px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="draw-name-select" className="flex items-center mb-1 text-sm font-medium text-muted-foreground">
              <ListFilter className="w-4 h-4 mr-2"/>
              Select Draw Name
            </Label>
            <Select value={selectedDrawName} onValueChange={setSelectedDrawName}>
              <SelectTrigger id="draw-name-select" className="w-full md:w-[240px]">
                <SelectValue placeholder="Select draw name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Draws</SelectItem>
                {allDrawNames.map(name => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
         <TabsList className="grid w-full grid-cols-2 md:w-1/2 mt-6">
          <TabsTrigger value="mostFrequent">Most Frequent</TabsTrigger>
          <TabsTrigger value="leastFrequent">Least Frequent</TabsTrigger>
        </TabsList>
      </CardHeader>
     
      {loading ? (
        <div className="space-y-4 mt-4">
          <Skeleton className="h-[400px] w-full" />
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-15 gap-2">
            {Array.from({length: CHART_ITEMS_COUNT}).map((_, idx) => <Skeleton key={idx} className="h-10 w-10 rounded-full" />)}
          </div>
        </div>
      ) : noDataForFilters ? (
         <Alert className="mt-4">
            <Terminal className="h-4 w-4" />
            <AlertTitle>No Data</AlertTitle>
            <AlertDescription>No lottery results found for the selected filters.</AlertDescription>
        </Alert>
      ) : (
        <>
          <TabsContent value="mostFrequent">
            <Card className="shadow-lg mt-4">
              <CardHeader>
                <CardTitle className="text-xl">Top {CHART_ITEMS_COUNT} Most Frequent Numbers</CardTitle>
              </CardHeader>
              <CardContent>
                {frequencies.length > 0 ? renderChart(mostFrequent, "Frequency (Most Frequent)") : <p className="text-muted-foreground">Not enough data for chart.</p>}
                <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {mostFrequent.map(item => <LotteryNumberDisplay key={`most-${item.number}`} number={item.number} />)}
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
                 {frequencies.length > 0 ? renderChart(leastFrequent, "Frequency (Least Frequent)") : <p className="text-muted-foreground">Not enough data for chart.</p>}
                 <div className="mt-6 grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2">
                  {leastFrequent.map(item => <LotteryNumberDisplay key={`least-${item.number}`} number={item.number} />)}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </>
      )}
    </Tabs>
  );
}


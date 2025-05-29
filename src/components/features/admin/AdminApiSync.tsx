
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { scrapeAndParseLotteryResultsFromAPI, addMultipleDrawResults, type DrawResult } from "@/services/lotteryApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CloudDownload, Loader2, AlertTriangle } from "lucide-react";

export function AdminApiSync() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);

  const handleApiSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    try {
      toast({ title: "Starting API Sync", description: "Fetching latest results from LotoBonheur.ci..." });
      const scrapedResults = await scrapeAndParseLotteryResultsFromAPI(); // Fetches API default (current month)
      
      if (scrapedResults.length === 0) {
        toast({ title: "API Sync Note", description: "No results were fetched from the API, or all fetched results were invalid.", duration: 7000 });
        setIsSyncing(false);
        return;
      }

      toast({ title: "API Data Fetched", description: `Successfully fetched ${scrapedResults.length} results. Now saving to Firestore...` });

      const { added, duplicates, errors: firestoreErrors } = await addMultipleDrawResults(scrapedResults);

      let summaryMessage = `API Sync Complete: Fetched ${scrapedResults.length} results. `;
      summaryMessage += `Added ${added.length} new results to Firestore. `;
      summaryMessage += `Skipped ${duplicates} duplicates. `;
      
      if (firestoreErrors.length > 0) {
        const firestoreErrorDetails = firestoreErrors.join("; ");
        const permissionHint = firestoreErrors.some(err => err.toLowerCase().includes("permission"))
          ? " This may be due to Firestore security rules. Please ensure the admin user has write permissions."
          : "";
        summaryMessage += `${firestoreErrors.length} Firestore save errors occurred. ${permissionHint}`;
        setSyncError(`Firestore save errors: ${firestoreErrorDetails}.${permissionHint}`);
         toast({
            variant: "destructive",
            title: "API Sync - Partial Success with Errors",
            description: summaryMessage + " Check console for details.",
            duration: 10000,
        });
      } else if (added.length === 0 && duplicates > 0 && scrapedResults.length > 0) {
         toast({
            title: "API Sync - No New Data",
            description: summaryMessage + " All fetched results were already in Firestore or duplicates.",
            duration: 7000,
        });
      } else if (added.length > 0 ) {
         toast({
            title: "API Sync Successful",
            description: summaryMessage,
            className: "bg-green-600 text-white",
            duration: 9000,
        });
      } else if (scrapedResults.length > 0 && added.length === 0 && duplicates === 0 && firestoreErrors.length === 0) {
        toast({
          title: "API Sync - No Changes",
          description: "All fetched results were invalid or resulted in no changes to the database.",
          duration: 7000,
        });
      } else {
         toast({
            title: "API Sync - Processed",
            description: summaryMessage, // Catch-all for cases like 0 fetched, 0 added, 0 duplicates
            duration: 7000
         });
      }


    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unknown error occurred during API sync.";
      const permissionHint = errorMessage.toLowerCase().includes("permission")
        ? " This may be due to Firestore security rules. Please ensure the admin user has write permissions."
        : "";
      setSyncError(`${errorMessage}${permissionHint}`);
      toast({ variant: "destructive", title: "API Sync Error", description: `${errorMessage}${permissionHint}`, duration: 9000 });
      console.error("API Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sync with LotoBonheur.ci API</CardTitle>
        <CardDescription>
          Fetch the latest lottery results directly from the LotoBonheur.ci API and save them to your Firestore database.
          This will add new results and skip any duplicates already present. It typically fetches data for the current month.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncError && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
              <p className="font-semibold">Sync Problem Occurred</p>
              <p className="text-sm">{syncError}</p>
            </div>
          </div>
        )}
        <Button onClick={handleApiSync} disabled={isSyncing} className="w-full sm:w-auto">
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
          {isSyncing ? "Syncing from API..." : "Fetch & Save Data from LotoBonheur.ci API"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Note: This process can take a moment. It fetches data from the external API, parses it,
          checks for duplicates against your Firestore data, and then saves new entries.
        </p>
      </CardContent>
    </Card>
  );
}

    

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { clearAdminCache, clearAllPredictions } from "@/services/lotteryApi";
import { DatabaseZap, Trash2, AlertTriangle } from "lucide-react";

export function SettingsDashboard() {
  const { toast } = useToast();
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [isClearingPredictions, setIsClearingPredictions] = useState(false);

  const handleClearCache = async () => {
    setIsClearingCache(true);
    try {
      await clearAdminCache();
      toast({
        title: "Cache Cleared",
        description: "Locally cached lottery results have been cleared. The app will fetch fresh data from the API.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error Clearing Cache",
        description: (error as Error).message,
      });
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleClearPredictions = async () => {
    setIsClearingPredictions(true);
    try {
      await clearAllPredictions();
      toast({
        title: "Prediction History Cleared",
        description: "All saved prediction history has been removed.",
      });
    } catch (error) {
      // This catch might not be hit if clearAllPredictions itself doesn't throw for IDB unavailability
      toast({
        variant: "destructive",
        title: "Error Clearing Predictions",
        description: (error as Error).message || "Could not clear predictions. IndexedDB might be unavailable.",
      });
    } finally {
      setIsClearingPredictions(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <DatabaseZap className="mr-2 h-5 w-5" />
            Data Management
          </CardTitle>
          <CardDescription>
            Manage application data caches and history. These actions can affect
            data display and AI learning.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Clear Locally Cached Lottery Results</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This will remove any admin-modified or imported lottery results stored in the current session.
                The application will revert to fetching live data from the Loto Bonheur API on the next load.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="mt-3 sm:mt-0 sm:ml-4" disabled={isClearingCache}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isClearingCache ? "Clearing..." : "Clear Cached Results"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2" />Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will clear all locally cached lottery results.
                    The application will fetch fresh data from the API. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearCache}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Yes, Clear Cache
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-semibold">Clear All Prediction History</h3>
              <p className="text-sm text-muted-foreground mt-1">
                This will permanently delete all prediction records stored in your browser (IndexedDB).
                This action will affect the AI's learning process as historical prediction accuracy data will be lost.
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="mt-3 sm:mt-0 sm:ml-4" disabled={isClearingPredictions}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  {isClearingPredictions ? "Clearing..." : "Clear Prediction History"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle className="flex items-center"><AlertTriangle className="text-destructive mr-2" />Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action will permanently delete all prediction history.
                    This will reset any learning the AI has done based on past predictions. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleClearPredictions}
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                  >
                    Yes, Clear History
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Placeholder for future settings */}
      {/*
      <Card>
        <CardHeader>
          <CardTitle>Theme Settings</CardTitle>
          <CardDescription>Customize the application's appearance.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Theme customization options will be available here in the future.</p>
        </CardContent>
      </Card>
      */}
    </div>
  );
}

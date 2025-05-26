
"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getAllLotteryResultsForExport, setAllLotteryResults, type DrawResult } from "@/services/lotteryApi";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Upload, Download, Loader2 } from "lucide-react";

export function AdminDataImportExport() {
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const results = await getAllLotteryResultsForExport();
      if (results.length === 0) {
        toast({ title: "No Data", description: "There is no data to export." });
        return;
      }
      const jsonString = JSON.stringify(results, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "lottery_results_export.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({ title: "Success", description: "Data exported successfully." });
    } catch (error) {
      toast({ variant: "destructive", title: "Export Error", description: (error as Error).message });
    } finally {
      setIsExporting(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') {
            throw new Error("Failed to read file content.");
        }
        const importedResults = JSON.parse(text) as DrawResult[];
        // Basic validation (can be more thorough)
        if (!Array.isArray(importedResults) || !importedResults.every(item => item.draw_name && item.date && item.gagnants)) {
            throw new Error("Invalid JSON format or missing required fields.");
        }
        await setAllLotteryResults(importedResults);
        toast({ title: "Success", description: "Data imported successfully. Refresh result lists to see changes." });
      } catch (error) {
        toast({ variant: "destructive", title: "Import Error", description: (error as Error).message });
      } finally {
        setIsImporting(false);
        if(fileInputRef.current) fileInputRef.current.value = ""; // Reset file input
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
          <CardDescription>Export all lottery results as a JSON file.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleExport} disabled={isExporting} className="w-full sm:w-auto">
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export to JSON
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
          <CardDescription>Import lottery results from a JSON file. This will replace existing data.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="import-file">JSON File</Label>
          <Input 
            id="import-file" 
            type="file" 
            accept=".json" 
            onChange={handleImport} 
            ref={fileInputRef} 
            disabled={isImporting} 
            className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
           {isImporting && <div className="flex items-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Importing...</div>}
        </CardContent>
      </Card>
    </div>
  );
}


"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { extractLotteryDataFromImage, type ExtractLotteryDataOutput } from "@/ai/flows/extract-lottery-data-from-image";
import type { DrawResult } from "@/services/lotteryApi";
import { addMultipleDrawResults } from "@/services/lotteryApi";
import { parse as parseDate, isValid, format } from "date-fns";
import { fr } from "date-fns/locale";

// Helper to parse French month names
const frenchMonthToNumber: { [key: string]: string } = {
  'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
  'juillet': '07', 'août': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12'
};

function parseFrenchDate(dateStr: string): string | null {
  // Try direct parsing with locale first (e.g., "19 mai 2025")
  let parsed = parseDate(dateStr, 'dd MMMM yyyy', new Date(), { locale: fr });
  if (isValid(parsed)) {
    return format(parsed, 'yyyy-MM-dd');
  }

  // Fallback for "dd mois yyyy" e.g. "19 Mai 2025" or "02 Décembre 2024"
  // This regex is more flexible for inconsistent casing or spacing
  const datePartsRegex = /(\d{1,2})\s*([a-zA-Zéûû]+)\s*(\d{4})/i;
  const match = dateStr.match(datePartsRegex);

  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2].toLowerCase();
    const year = match[3];
    const monthNumber = frenchMonthToNumber[monthName];

    if (day && monthNumber && year) {
      parsed = parseDate(`${year}-${monthNumber}-${day}`, 'yyyy-MM-dd', new Date());
      if (isValid(parsed)) {
        return format(parsed, 'yyyy-MM-dd');
      }
    }
  }
  console.warn(`Failed to parse date string: ${dateStr}`);
  return null; // Return null if parsing fails
}


export function AdminImageImport() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractLotteryDataOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setError(null);
      setExtractedData(null);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setSelectedImage(null);
      setImagePreview(null);
    }
  };

  const handleImageImport = async () => {
    if (!selectedImage || !imagePreview) {
      toast({ variant: "destructive", title: "No Image", description: "Please select an image to import." });
      return;
    }

    setIsImporting(true);
    setError(null);
    setExtractedData(null);

    try {
      const aiResult = await extractLotteryDataFromImage({ imageDataUri: imagePreview });
      setExtractedData(aiResult);

      if (!aiResult.drawName || !aiResult.results || aiResult.results.length === 0) {
        throw new Error("AI did not return a valid draw name or any results.");
      }
      
      const resultsToSave: Array<Omit<DrawResult, 'id'>> = [];
      let parsingErrors = 0;

      for (const item of aiResult.results) {
        const parsedDateStr = parseFrenchDate(item.date);
        if (!parsedDateStr) {
          console.error(`Skipping result due to invalid date: ${item.date}`);
          toast({ variant: "destructive", title: "Date Parsing Error", description: `Invalid date format for an entry: ${item.date}. This entry was skipped.` });
          parsingErrors++;
          continue;
        }
        if (item.winningNumbers.length !== 5 || item.machineNumbers.length !== 5) {
          console.error(`Skipping result due to incorrect number count: Date ${item.date}`);
          toast({ variant: "destructive", title: "Data Error", description: `Entry for ${item.date} has incorrect number of balls. This entry was skipped.` });
          parsingErrors++;
          continue;
        }

        resultsToSave.push({
          draw_name: aiResult.drawName, // Use the common drawName extracted by AI
          date: parsedDateStr,
          gagnants: item.winningNumbers,
          machine: item.machineNumbers,
        });
      }
      
      if (resultsToSave.length === 0 && aiResult.results.length > 0) {
         throw new Error("No valid results could be parsed from the AI output. Check console for details.");
      }
      
      if (resultsToSave.length > 0) {
        await addMultipleDrawResults(resultsToSave);
        toast({
            title: "Import Successful",
            description: `${resultsToSave.length} results for draw "${aiResult.drawName}" imported. ${parsingErrors > 0 ? `${parsingErrors} entries skipped due to errors.` : ''}`,
            className: "bg-green-600 text-white",
            duration: 5000,
         });
      } else if (parsingErrors > 0) {
         toast({
            variant: "destructive",
            title: "Import Partially Failed",
            description: `All ${parsingErrors} entries had errors and were skipped. No data imported.`,
         });
      } else {
         toast({
            title: "No Data Imported",
            description: `No processable results found in the image for draw "${aiResult.drawName}".`,
         });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during image import.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Import Error", description: errorMessage });
      console.error("Image import error:", err);
    } finally {
      setIsImporting(false);
      // Optionally clear selection after import attempt
      // setSelectedImage(null);
      // setImagePreview(null);
      // if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Lottery Results from Image</CardTitle>
        <CardDescription>Upload an image containing lottery results. The AI will attempt to extract the data.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="image-upload">Lottery Result Image</Label>
          <Input
            id="image-upload"
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            ref={fileInputRef}
            disabled={isImporting}
            className="cursor-pointer file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
        </div>

        {imagePreview && (
          <div className="space-y-2">
            <Label>Image Preview</Label>
            <div className="border rounded-md p-2 flex justify-center bg-muted/30">
              <Image src={imagePreview} alt="Selected lottery results" width={600} height={400} style={{ objectFit: 'contain', maxHeight: '400px' }} />
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
                <p className="font-semibold">Import Failed</p>
                <p className="text-sm">{error}</p>
            </div>
          </div>
        )}
        
        {extractedData && !error && (
             <div className="p-4 bg-green-600/10 text-green-700 dark:text-green-300 border border-green-600/30 rounded-md flex items-start">
                <CheckCircle2 className="h-5 w-5 mr-3 flex-shrink-0" />
                <div>
                    <p className="font-semibold">Extraction Successful & Data Processed</p>
                    <p className="text-sm">Draw: {extractedData.drawName}, {extractedData.results.length} rows initially extracted by AI.</p>
                    <p className="text-sm">Check toast notifications for import status.</p>
                </div>
            </div>
        )}


        <Button onClick={handleImageImport} disabled={isImporting || !selectedImage} className="w-full sm:w-auto">
          {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isImporting ? "Importing..." : "Import Data from Image"}
        </Button>

      </CardContent>
    </Card>
  );
}

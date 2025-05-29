
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, Loader2, AlertTriangle, CheckCircle2, FileWarning } from "lucide-react";
import { extractLotteryDataFromImage, type ExtractLotteryDataOutput } from "@/ai/flows/extract-lottery-data-from-image";
import type { DrawResult } from "@/services/lotteryApi";
import { addMultipleDrawResults } from "@/services/lotteryApi";
import { parse as parseDate, isValid, format } from "date-fns";
import { fr } from "date-fns/locale";

// Helper to parse French month names
const frenchMonthToNumber: { [key: string]: string } = {
  'janvier': '01', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06', // fevrier without accent for normalization
  'juillet': '07', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'decembre': '12' // aout and decembre without accent
};

function parseFrenchDate(dateStr: string): string | null {
  // Normalize to lowercase and remove accents for robust matching
  const normalizedDateStr = dateStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  // Try direct parsing with locale first (e.g., "19 mai 2025")
  let parsed = parseDate(dateStr, 'dd MMMM yyyy', new Date(), { locale: fr });
  if (isValid(parsed)) {
    return format(parsed, 'yyyy-MM-dd');
  }
  
  // Regex to find day, month (text), year from normalized string
  const datePartsRegex = /(\d{1,2})\s*([a-z]+)\s*(\d{4})/;
  const match = normalizedDateStr.match(datePartsRegex);

  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2]; // Already normalized
    const year = match[3];
    
    // Find month number by matching normalized month name
    const monthNumber = frenchMonthToNumber[monthName as keyof typeof frenchMonthToNumber] || 
                        Object.entries(frenchMonthToNumber).find(([,val]) => monthName.startsWith(val.substring(0,3)))?.[0];


    if (day && monthNumber && year) {
      // Ensure monthNumber from the matched key (e.g. 'janvier' maps to '01')
      const numericMonth = frenchMonthToNumber[monthNumber as keyof typeof frenchMonthToNumber];
      if (numericMonth) {
        parsed = parseDate(`${year}-${numericMonth}-${day}`, 'yyyy-MM-dd', new Date());
        if (isValid(parsed)) {
          return format(parsed, 'yyyy-MM-dd');
        }
      }
    }
  }
  console.warn(`Failed to parse date string: ${dateStr} (normalized: ${normalizedDateStr})`);
  return null;
}


export function AdminImageImport() {
  const { toast } = useToast();
  const [isImporting, setIsImporting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractLotteryDataOutput | null>(null);
  const [importError, setImportError] = useState<string | null>(null); 
  const [processingSummary, setProcessingSummary] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImportError(null);
      setExtractedData(null);
      setProcessingSummary(null);
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
    setImportError(null);
    setExtractedData(null);
    setProcessingSummary(null);

    try {
      const aiResult = await extractLotteryDataFromImage({ imageDataUri: imagePreview });
      setExtractedData(aiResult);

      if (!aiResult.drawName || !aiResult.results || aiResult.results.length === 0) {
        throw new Error("AI did not return a valid draw name or any results.");
      }
      
      const resultsToProcess: Array<Omit<DrawResult, 'id'>> = [];
      let parsingErrorsCount = 0;
      let invalidWinningNumbersCount = 0;

      for (const item of aiResult.results) {
        const parsedDateStr = parseFrenchDate(item.date);
        if (!parsedDateStr) {
          console.error(`Skipping result due to invalid date: ${item.date}`);
          parsingErrorsCount++;
          continue;
        }

        const validWinningNumbers = item.winningNumbers.filter(n => n >= 1 && n <= 90);
        if (validWinningNumbers.length !== 5) {
          console.error(`Skipping result for date ${item.date} due to invalid or incomplete winning numbers (found ${validWinningNumbers.length}, expected 5). Original: ${item.winningNumbers.join(',')}`);
          invalidWinningNumbersCount++;
          continue;
        }

        const validMachineNumbers = item.machineNumbers.filter(n => n >= 1 && n <= 90);
        
        resultsToProcess.push({
          draw_name: aiResult.drawName,
          date: parsedDateStr,
          gagnants: validWinningNumbers,
          machine: validMachineNumbers.length > 0 ? validMachineNumbers : undefined,
        });
      }
      
      if (resultsToProcess.length === 0 && aiResult.results.length > 0) {
         const errorDetail = invalidWinningNumbersCount > 0 ? `${invalidWinningNumbersCount} entries had invalid winning numbers.` : `${parsingErrorsCount} entries had date parsing errors.`;
         throw new Error(`No valid results could be processed from the AI output. ${errorDetail} Check console for details.`);
      }
      
      let addedCount = 0;
      let duplicateCount = 0;
      let firestoreErrorMessages: string[] = [];

      if (resultsToProcess.length > 0) {
        const { added, duplicates, errors: fsErrors } = await addMultipleDrawResults(resultsToProcess);
        addedCount = added.length;
        duplicateCount = duplicates;
        firestoreErrorMessages = fsErrors;
        
        const summary = `Draw: ${aiResult.drawName}. AI Extracted: ${aiResult.results.length}. Processable: ${resultsToProcess.length}. Added to DB: ${addedCount}. Duplicates Skipped: ${duplicateCount}. Invalid Dates: ${parsingErrorsCount}. Invalid Winning #: ${invalidWinningNumbersCount}. DB Errors: ${firestoreErrorMessages.length}.`;
        setProcessingSummary(summary);

        if (addedCount > 0 && firestoreErrorMessages.length === 0) {
            toast({
                title: "Import Successful",
                description: `${addedCount} new results for "${aiResult.drawName}" imported to Firestore. Full summary: ${summary}`,
                className: "bg-green-600 text-white",
                duration: 9000,
            });
        } else if (firestoreErrorMessages.length > 0) {
             toast({
                variant: "destructive",
                title: "Import Partially Failed",
                description: `Some results for "${aiResult.drawName}" could not be saved to Firestore. ${addedCount} added. ${firestoreErrorMessages.length} DB errors. Details: ${firestoreErrorMessages.join('; ')}. Full summary: ${summary}`,
                duration: 12000,
            });
            setImportError(`Firestore errors occurred. ${firestoreErrorMessages.join('; ')}`);
        } else if (resultsToProcess.length > 0) { 
             toast({
                title: "Import Processed - No New Data",
                description: `No new results were added for "${aiResult.drawName}". This may be due to all entries being duplicates, or failing local validation. Full summary: ${summary}`,
                className: "bg-yellow-500 text-black",
                duration: 9000,
            });
        } else { 
             toast({
                variant: "destructive",
                title: "Import Failed - No Processable Data",
                description: `No processable data was found in the AI output for "${aiResult.drawName}" after local validation. Full summary: ${summary}`,
                duration: 9000,
            });
            setImportError("No processable data from AI output after local validation.");
        }

      } else if (invalidWinningNumbersCount > 0 || parsingErrorsCount > 0) {
         const summary = `Draw: ${aiResult.drawName}. AI Extracted: ${aiResult.results.length}. Processable: 0. Invalid Dates: ${parsingErrorsCount}. Invalid Winning #: ${invalidWinningNumbersCount}.`;
         setProcessingSummary(summary);
         toast({
            variant: "destructive",
            title: "Import Failed - Data Validation Errors",
            description: `All ${aiResult.results.length} entries from AI had errors (winning numbers or dates) and were skipped. No data imported. ${summary}`,
            duration: 9000,
         });
         setImportError("All entries from AI had processing errors (dates or winning numbers).");
      } else {
         const summary = `Draw: ${aiResult.drawName}. AI Extracted: ${aiResult.results.length}. No data to process.`;
         setProcessingSummary(summary);
         toast({
            title: "No Data to Import",
            description: `No processable results found in the image for draw "${aiResult.drawName}". ${summary}`,
            duration: 7000,
         });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown error occurred during image import.";
      setImportError(errorMessage);
      toast({ variant: "destructive", title: "Critical Import Error", description: errorMessage, duration: 7000 });
      console.error("Image import error:", err);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import Lottery Results from Image</CardTitle>
        <CardDescription>Upload an image containing lottery results. The AI will attempt to extract the data, which will then be saved to Firestore.</CardDescription>
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

        {importError && (
          <div className="p-4 bg-destructive/10 text-destructive border border-destructive/30 rounded-md flex items-start">
            <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" />
            <div>
                <p className="font-semibold">Import Problem Occurred</p>
                <p className="text-sm">{importError}</p>
            </div>
          </div>
        )}
        
        {processingSummary && ( 
             <div className={`p-4 border rounded-md flex items-start ${
                importError 
                    ? "bg-destructive/10 text-destructive border-destructive/30" 
                    : (processingSummary.includes("Added to DB: 0") && !processingSummary.includes("DB Errors: 0") && !processingSummary.includes("AI Extracted: 0")) // No DB adds, but not because of DB errors or no AI data
                        ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30" 
                        : "bg-green-600/10 text-green-700 dark:text-green-300 border-green-600/30"
                }`}>
                {importError ? <AlertTriangle className="h-5 w-5 mr-3 flex-shrink-0" /> : (processingSummary.includes("Added to DB: 0") && !processingSummary.includes("DB Errors: 0")  && !processingSummary.includes("AI Extracted: 0") ? <FileWarning className="h-5 w-5 mr-3 flex-shrink-0" /> : <CheckCircle2 className="h-5 w-5 mr-3 flex-shrink-0" />)}
                <div>
                    <p className="font-semibold">Processing Summary</p>
                    <p className="text-sm whitespace-pre-line">{processingSummary}</p>
                    {!importError && <p className="text-sm mt-1">Check toast notifications for detailed status.</p>}
                </div>
            </div>
        )}


        <Button onClick={handleImageImport} disabled={isImporting || !selectedImage} className="w-full sm:w-auto">
          {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isImporting ? "Importing to Firestore..." : "Import Data from Image to Firestore"}
        </Button>

      </CardContent>
    </Card>
  );
}


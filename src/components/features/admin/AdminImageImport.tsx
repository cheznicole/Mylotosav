
"use client";

import { useState, useRef } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { UploadCloud, Loader2, AlertTriangle, CheckCircle2, FileWarning, Info } from "lucide-react"; // Added Info
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"; // Added Alert components
import { extractLotteryDataFromImage, type ExtractLotteryDataOutput } from "@/ai/flows/extract-lottery-data-from-image";
import type { DrawResult } from "@/services/lotteryApi";
import { addMultipleDrawResults } from "@/services/lotteryApi";
import { parse as parseDate, isValid, format } from "date-fns";
import { fr } from "date-fns/locale";

// Helper to parse French month names
const frenchMonthToNumber: { [key: string]: string } = {
  'janvier': '01', 'fevrier': '02', 'mars': '03', 'avril': '04', 'mai': '05', 'juin': '06',
  'juillet': '07', 'aout': '08', 'septembre': '09', 'octobre': '10', 'novembre': '11', 'decembre': '12'
};

function parseFrenchDate(dateStr: string): string | null {
  const normalizedDateStr = dateStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  
  let parsed = parseDate(dateStr, 'dd MMMM yyyy', new Date(), { locale: fr });
  if (isValid(parsed)) {
    return format(parsed, 'yyyy-MM-dd');
  }
  
  const datePartsRegex = /(\d{1,2})\s*([a-z]+)\s*(\d{4})/;
  const match = normalizedDateStr.match(datePartsRegex);

  if (match) {
    const day = match[1].padStart(2, '0');
    const monthName = match[2]; 
    const year = match[3];
    
    const monthNumberKey = Object.keys(frenchMonthToNumber).find(key => 
        key === monthName || monthName.startsWith(key.substring(0,3))
    );

    if (day && monthNumberKey && year) {
      const numericMonth = frenchMonthToNumber[monthNumberKey];
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
  const [extractedData, setExtractedData] = useState<ExtractLotteryDataOutput | null>(null); // Kept for potential debugging, not directly shown
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
      toast({ variant: "destructive", title: "Aucune Image", description: "Veuillez sélectionner une image à importer." });
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setExtractedData(null);
    setProcessingSummary(null);
    let aiResult: ExtractLotteryDataOutput;

    try {
      toast({title: "Traitement IA en cours...", description: "Extraction des données de l'image."});
      aiResult = await extractLotteryDataFromImage({ imageDataUri: imagePreview });
      setExtractedData(aiResult); // Store AI result for potential debugging

      if (!aiResult || !aiResult.drawName || !aiResult.results ) {
        throw new Error("L'IA n'a pas retourné un nom de tirage valide ou des résultats.");
      }
      if (aiResult.results.length === 0) {
         const noResultsMessage = `L'IA a extrait le nom du tirage "${aiResult.drawName}" mais n'a trouvé aucune ligne de résultat dans l'image.`;
         setProcessingSummary(noResultsMessage);
         toast({
             title: "Aucune Donnée de Résultat Extraite",
             description: noResultsMessage,
             className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
             duration: 9000
         });
         setIsImporting(false);
         if (fileInputRef.current) fileInputRef.current.value = "";
         return;
      }
      
      toast({title: "Données extraites par IA", description: `Traitement des ${aiResult.results.length} lignes pour le tirage "${aiResult.drawName}".`});

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
          machine: validMachineNumbers.length > 0 ? validMachineNumbers : undefined, // Ensure undefined if empty for Firestore
        });
      }
      
      let summary = `Tirage: ${aiResult.drawName}. IA Extraites: ${aiResult.results.length}. `;
      summary += `Traitables: ${resultsToProcess.length}. Erreurs Date: ${parsingErrorsCount}. Erreurs Numéros Gagnants: ${invalidWinningNumbersCount}.`;

      if (resultsToProcess.length === 0 && aiResult.results.length > 0) {
         const errorDetail = invalidWinningNumbersCount > 0 ? `${invalidWinningNumbersCount} entrées avaient des numéros gagnants invalides.` : `${parsingErrorsCount} entrées avaient des erreurs de parsing de date.`;
         setProcessingSummary(summary);
         throw new Error(`Aucun résultat valide n'a pu être traité à partir de la sortie IA. ${errorDetail} Vérifiez la console pour les détails.`);
      }
      
      let addedCount = 0;
      let duplicateCount = 0;
      let firestoreErrorMessages: string[] = [];

      if (resultsToProcess.length > 0) {
        toast({title: "Sauvegarde Firestore...", description: `Tentative d'ajout de ${resultsToProcess.length} résultats pour "${aiResult.drawName}".`});
        const { added, duplicates, errors: fsErrors } = await addMultipleDrawResults(resultsToProcess);
        addedCount = added.length;
        duplicateCount = duplicates;
        firestoreErrorMessages = fsErrors;
        
        summary += ` Ajoutés DB: ${addedCount}. Doublons Ignorés: ${duplicateCount}. Erreurs DB: ${firestoreErrorMessages.length}.`;
        setProcessingSummary(summary);

        const firestoreErrorDetails = firestoreErrorMessages.join('; ');
        const permissionHint = firestoreErrorMessages.some(err => err.toLowerCase().includes("permission")) 
          ? " CRITIQUE : Ceci peut être dû à des règles de sécurité Firestore. Veuillez vous assurer que l'utilisateur admin a les permissions d'écriture et les revendications 'admin:true'." 
          : "";

        if (addedCount > 0 && firestoreErrorMessages.length === 0) {
            toast({
                title: "Importation Réussie",
                description: `${addedCount} nouveaux résultats pour "${aiResult.drawName}" importés dans Firestore. ${summary}`,
                className: "bg-green-600/10 text-green-700 dark:text-green-300 border-green-600/30",
                duration: 9000,
            });
        } else if (firestoreErrorMessages.length > 0) {
             const toastDescription = `${addedCount} résultats ajoutés pour "${aiResult.drawName}". ${firestoreErrorMessages.length} erreurs DB. Détails: ${firestoreErrorDetails}.${permissionHint} ${summary}`;
             setImportError(`Erreurs Firestore : ${firestoreErrorDetails}.${permissionHint}`);
             toast({
                variant: "destructive",
                title: "Importation Partiellement Échouée",
                description: toastDescription,
                duration: 15000,
            });
        } else if (resultsToProcess.length > 0) { // Processed, but nothing new added (e.g. all duplicates)
             toast({
                title: "Importation Traitée - Aucune Nouvelle Donnée",
                description: `Aucun nouveau résultat n'a été ajouté pour "${aiResult.drawName}". Cela peut être dû au fait que toutes les entrées sont des doublons ou ont échoué à la validation locale. ${summary}`,
                className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30", // Using blue for informational
                duration: 9000,
            });
        } else { // Should not be reached if earlier check for resultsToProcess.length === 0 is effective
             toast({
                variant: "destructive",
                title: "Importation Échouée - Aucune Donnée Traitable",
                description: `Aucune donnée traitable n'a été trouvée dans la sortie IA pour "${aiResult.drawName}" après validation locale. ${summary}`,
                duration: 9000,
            });
            setImportError("Aucune donnée traitable de la sortie IA après validation locale.");
        }

      } else if (invalidWinningNumbersCount > 0 || parsingErrorsCount > 0) {
         // This case means results were extracted by AI, but all failed local validation before Firestore attempt
         setProcessingSummary(summary);
         toast({
            variant: "destructive",
            title: "Importation Échouée - Erreurs de Validation des Données",
            description: `Toutes les ${aiResult.results.length} entrées de l'IA avaient des erreurs (numéros gagnants ou dates) et ont été ignorées. Aucune donnée importée. ${summary}`,
            duration: 9000,
         });
         setImportError("Toutes les entrées de l'IA avaient des erreurs de traitement (dates ou numéros gagnants).");
      } else { // AI extracted data, but resultsToProcess ended up empty for other reasons (should be rare)
         setProcessingSummary(summary);
         toast({
            title: "Aucune Donnée à Importer",
            description: `Aucun résultat traitable trouvé dans l'image pour le tirage "${aiResult.drawName}". ${summary}`,
            duration: 7000,
         });
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Une erreur inconnue est survenue lors de l'importation d'image.";
      const permissionHint = errorMessage.toLowerCase().includes("permission")
        ? " CRITIQUE : Ceci peut être dû à des règles de sécurité Firestore. Veuillez vous assurer que l'utilisateur admin a les permissions d'écriture et les revendications 'admin:true'."
        : "";
      setImportError(`${errorMessage}${permissionHint}`);
      toast({ variant: "destructive", title: "Erreur Critique d'Importation", description: `${errorMessage}${permissionHint}`, duration: 12000 });
      console.error("Image import error:", err);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importer les Résultats de Loterie depuis une Image</CardTitle>
        <CardDescription>Téléchargez une image contenant les résultats de loterie. L'IA tentera d'extraire les données, qui seront ensuite sauvegardées dans Firestore.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <Label htmlFor="image-upload">Image des Résultats de Loterie</Label>
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
            <Label>Aperçu de l'Image</Label>
            <div className="border rounded-md p-2 flex justify-center bg-muted/30">
              <Image src={imagePreview} alt="Résultats de loterie sélectionnés" width={600} height={400} style={{ objectFit: 'contain', maxHeight: '400px' }} />
            </div>
          </div>
        )}

        {importError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Problème d'Importation Survenu</AlertTitle>
            <AlertDescription>
                {importError}
                 {importError.toLowerCase().includes("permission") && (
                <p className="text-sm mt-2 font-medium">
                  ACTION REQUISE : Veuillez vérifier vos règles de sécurité Firestore dans la console Firebase.
                  Les utilisateurs administrateurs ont besoin de la permission d'écriture sur la collection 'lotteryResults' et doivent avoir les revendications personnalisées 'admin:true'.
                </p>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        {processingSummary && !importError && ( 
             <Alert 
                className={`mb-4 ${
                    processingSummary.includes("Ajoutés DB: 0") && (processingSummary.includes("Erreurs DB:") && !processingSummary.includes("Erreurs DB: 0")) 
                        ? "bg-destructive/10 text-destructive border-destructive/30" // Error if DB errors exist and 0 added
                        : (processingSummary.includes("Ajoutés DB: 0") || processingSummary.includes("Traitables: 0") || processingSummary.includes("Aucune Donnée de Résultat Extraite"))
                            ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30" // Warning if 0 added or 0 processable
                            : processingSummary.includes("Erreurs DB:") && !processingSummary.includes("Erreurs DB: 0")
                                ? "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30" // Orange for partial success with DB errors
                                : "bg-green-600/10 text-green-700 dark:text-green-300 border-green-600/30" // Success
                }`}
            >
                {processingSummary.includes("Ajoutés DB: 0") && (processingSummary.includes("Erreurs DB:") && !processingSummary.includes("Erreurs DB: 0")) ? <AlertTriangle className="h-5 w-5" /> :
                 (processingSummary.includes("Ajoutés DB: 0") || processingSummary.includes("Traitables: 0") || processingSummary.includes("Aucune Donnée de Résultat Extraite")) ? <FileWarning className="h-5 w-5" /> : 
                 processingSummary.includes("Erreurs DB:") && !processingSummary.includes("Erreurs DB: 0") ? <Info className="h-5 w-5" /> : 
                 <CheckCircle2 className="h-5 w-5" />}
                <AlertTitle>Résumé du Traitement</AlertTitle>
                <AlertDescription className="whitespace-pre-line">{processingSummary}</AlertDescription>
                {!importError && <p className="text-sm mt-1">Vérifiez les notifications (toast) pour le statut détaillé.</p>}
            </Alert>
        )}


        <Button onClick={handleImageImport} disabled={isImporting || !selectedImage} className="w-full sm:w-auto">
          {isImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UploadCloud className="mr-2 h-4 w-4" />}
          {isImporting ? "Importation vers Firestore..." : "Importer les Données de l'Image vers Firestore"}
        </Button>

      </CardContent>
    </Card>
  );
}

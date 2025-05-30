
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { scrapeAndParseLotteryResultsFromAPI, addMultipleDrawResults } from "@/services/lotteryApi"; // type DrawResult removed as not used here
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CloudDownload, Loader2, AlertTriangle, CheckCircle2, Info } from "lucide-react"; // Added CheckCircle2, Info
import { Alert, AlertTitle, AlertDescription as UiAlertDescription } from "@/components/ui/alert"; // Renamed AlertDescription to avoid conflict

export function AdminApiSync() {
  const { toast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<string | null>(null);

  const handleApiSync = async () => {
    setIsSyncing(true);
    setSyncError(null);
    setSyncSummary(null);
    try {
      toast({ title: "Démarrage de la Synchronisation API", description: "Récupération des derniers résultats depuis LotoBonheur.ci..." });
      const scrapedResults = await scrapeAndParseLotteryResultsFromAPI(); 
      
      if (scrapedResults.length === 0) {
        const noResultsMsg = "Aucun résultat n'a été récupéré de l'API, ou tous les résultats récupérés étaient invalides.";
        setSyncSummary(noResultsMsg);
        toast({ 
            title: "Synchronisation API - Aucune Donnée", 
            description: noResultsMsg, 
            duration: 7000,
            className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30"
        });
        setIsSyncing(false);
        return;
      }

      toast({ title: "Données API Récupérées", description: `Récupération réussie de ${scrapedResults.length} résultats. Sauvegarde dans Firestore en cours...` });

      const { added, duplicates, errors: firestoreErrors } = await addMultipleDrawResults(scrapedResults);

      let summaryMessage = `Synchronisation API Terminée : ${scrapedResults.length} résultats récupérés. `;
      summaryMessage += `${added.length} nouveaux résultats ajoutés à Firestore. `;
      summaryMessage += `${duplicates} doublons ignorés. `;
      
      const hasPermissionError = firestoreErrors.some(err => err.toLowerCase().includes("permission") || err.toLowerCase().includes("missing or insufficient permissions"));

      if (firestoreErrors.length > 0) {
        const firestoreErrorDetails = firestoreErrors.join("; ");
        let permissionHint = "";
        if (hasPermissionError) {
            permissionHint = " CRITIQUE : Ceci est probablement dû à des règles de sécurité Firestore. Si vous souhaitez que tous les utilisateurs connectés puissent utiliser cette fonctionnalité, assurez-vous que vos règles Firestore autorisent l'écriture dans la collection 'lotteryResults' pour tout utilisateur authentifié (par exemple, `allow write: if request.auth != null;`). Si seuls des administrateurs spécifiques (avec une revendication 'admin:true') doivent avoir ce droit, alors l'utilisateur actuel doit avoir cette revendication et les règles Firestore doivent la vérifier (`request.auth.token.admin == true`).";
        }
        summaryMessage += `${firestoreErrors.length} erreurs de sauvegarde Firestore se sont produites.${permissionHint}`;
        setSyncError(`Erreurs de sauvegarde Firestore : ${firestoreErrorDetails}.${permissionHint}`);
         toast({
            variant: "destructive",
            title: "Synchronisation API - Succès Partiel avec Erreurs",
            description: summaryMessage + " Vérifiez la console pour les détails et le message d'erreur ci-dessus.",
            duration: 15000, 
        });
      } else if (added.length === 0 && duplicates > 0 && scrapedResults.length > 0) {
         setSyncSummary(summaryMessage + " Tous les résultats récupérés étaient déjà dans Firestore ou des doublons.");
         toast({
            title: "Synchronisation API - Aucune Nouvelle Donnée",
            description: summaryMessage + " Tous les résultats récupérés étaient déjà dans Firestore ou des doublons.",
            className: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
            duration: 9000,
        });
      } else if (added.length > 0 ) {
         setSyncSummary(summaryMessage);
         toast({
            title: "Synchronisation API Réussie",
            description: summaryMessage,
            className: "bg-green-600/10 text-green-700 dark:text-green-300 border-green-600/30",
            duration: 9000,
        });
      } else if (scrapedResults.length > 0 && added.length === 0 && duplicates === 0 && firestoreErrors.length === 0) {
        const noChangesMsg = "Tous les résultats récupérés étaient invalides ou n'ont entraîné aucune modification de la base de données.";
        setSyncSummary(summaryMessage + " " + noChangesMsg);
        toast({
          title: "Synchronisation API - Aucun Changement",
          description: noChangesMsg,
          className: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
          duration: 7000,
        });
      } else { 
         setSyncSummary(summaryMessage);
         toast({
            title: "Synchronisation API - Traitée",
            description: summaryMessage, 
            duration: 7000
         });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue lors de la synchronisation API.";
      const isPermissionError = errorMessage.toLowerCase().includes("permission") || errorMessage.toLowerCase().includes("missing or insufficient permissions");
      let permissionHint = "";
      if (isPermissionError) {
          permissionHint = " CRITIQUE : Ceci pourrait être dû à des règles de sécurité Firestore. Si vous souhaitez que tous les utilisateurs connectés puissent utiliser cette fonctionnalité, assurez-vous que vos règles Firestore autorisent l'écriture dans la collection 'lotteryResults' pour tout utilisateur authentifié (par exemple, `allow write: if request.auth != null;`). Si seuls des administrateurs spécifiques (avec une revendication 'admin:true') doivent avoir ce droit, alors l'utilisateur actuel doit avoir cette revendication et les règles Firestore doivent la vérifier (`request.auth.token.admin == true`).";
      }
      setSyncError(`${errorMessage}${permissionHint}`);
      setSyncSummary(`Erreur critique pendant la synchronisation : ${errorMessage}`);
      toast({ variant: "destructive", title: "Erreur de Synchronisation API", description: `${errorMessage}${permissionHint}`, duration: 15000 });
      console.error("API Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Synchroniser avec l'API LotoBonheur.ci</CardTitle>
        <CardDescription>
          Récupérez les derniers résultats de loterie directement depuis l'API LotoBonheur.ci et sauvegardez-les dans votre base de données Firestore.
          Cela ajoutera de nouveaux résultats et ignorera les doublons déjà présents. Typiquement, cela récupère les données du mois en cours.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {syncError && (
          <Alert variant="destructive" className="mb-4">
            <AlertTriangle className="h-5 w-5" />
            <AlertTitle>Problème de Synchronisation Survenu</AlertTitle>
            <UiAlertDescription>
              {syncError}
              {(syncError.toLowerCase().includes("permission") || syncError.toLowerCase().includes("missing or insufficient permissions")) && (
                <p className="text-sm mt-2 font-medium">
                  ACTION REQUISE : Veuillez vérifier vos règles de sécurité Firestore dans la console Firebase.
                  Si tous les utilisateurs connectés doivent pouvoir synchroniser, la règle pour 'lotteryResults' pourrait être `allow write: if request.auth != null;`.
                </p>
              )}
            </UiAlertDescription>
          </Alert>
        )}
        {syncSummary && !syncError && (
             <Alert 
                className={`mb-4 ${
                    syncSummary.includes("nouveaux résultats ajoutés") ? "bg-green-600/10 text-green-700 dark:text-green-300 border-green-600/30" : 
                    syncSummary.includes("Aucune Donnée") || syncSummary.includes("Aucun Changement") ? "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/30" :
                    "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30" 
                }`}
            >
                {syncSummary.includes("nouveaux résultats ajoutés") ? <CheckCircle2 className="h-5 w-5" /> : <Info className="h-5 w-5" />}
                <AlertTitle>Résumé de la Synchronisation</AlertTitle>
                <UiAlertDescription>{syncSummary}</UiAlertDescription>
            </Alert>
        )}
        <Button onClick={handleApiSync} disabled={isSyncing} className="w-full sm:w-auto">
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CloudDownload className="mr-2 h-4 w-4" />}
          {isSyncing ? "Synchronisation depuis l'API..." : "Récupérer & Sauvegarder les Données de LotoBonheur.ci"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Note : Ce processus peut prendre un moment. Il récupère les données de l'API externe, les analyse,
          vérifie les doublons par rapport à vos données Firestore, puis enregistre les nouvelles entrées.
        </p>
      </CardContent>
    </Card>
  );
}

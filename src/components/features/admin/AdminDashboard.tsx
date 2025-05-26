
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminResultsManager } from "./AdminResultsManager";
import { AdminDataImportExport } from "./AdminDataImportExport";
import { AdminImageImport } from "./AdminImageImport"; // Import the new component
import { DatabaseZap, FileJson, ImageUp } from "lucide-react";


export function AdminDashboard() {
  return (
    <Tabs defaultValue="results" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 mb-6">
        <TabsTrigger value="results"><DatabaseZap className="w-4 h-4 mr-2" />Manage Results</TabsTrigger>
        <TabsTrigger value="import-export"><FileJson className="w-4 h-4 mr-2" />Import/Export JSON</TabsTrigger>
        <TabsTrigger value="import-image"><ImageUp className="w-4 h-4 mr-2" />Import from Image</TabsTrigger> 
      </TabsList>
      <TabsContent value="results">
        <AdminResultsManager />
      </TabsContent>
      <TabsContent value="import-export">
        <AdminDataImportExport />
      </TabsContent>
      <TabsContent value="import-image">
        <AdminImageImport />
      </TabsContent>
    </Tabs>
  );
}

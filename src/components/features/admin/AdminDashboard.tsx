
"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminResultsManager } from "./AdminResultsManager";
import { AdminDataImportExport } from "./AdminDataImportExport";
import { AdminImageImport } from "./AdminImageImport";
import { AdminApiSync } from "./AdminApiSync"; // Import the new component
import { DatabaseZap, FileJson, ImageUp, CloudDownload } from "lucide-react";
// Minor change to attempt to resolve ChunkLoadError

export function AdminDashboard() {
  return (
    <Tabs defaultValue="results" className="w-full">
      <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
        <TabsTrigger value="results"><DatabaseZap className="w-4 h-4 mr-2" />Manage Results</TabsTrigger>
        <TabsTrigger value="import-export"><FileJson className="w-4 h-4 mr-2" />Import/Export JSON</TabsTrigger>
        <TabsTrigger value="import-image"><ImageUp className="w-4 h-4 mr-2" />Import from Image</TabsTrigger>
        <TabsTrigger value="api-sync"><CloudDownload className="w-4 h-4 mr-2" />Fetch from API</TabsTrigger> 
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
      <TabsContent value="api-sync">
        <AdminApiSync />
      </TabsContent>
    </Tabs>
  );
}

    

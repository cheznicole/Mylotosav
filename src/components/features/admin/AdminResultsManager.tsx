
"use client";

import { useEffect, useState } from "react";
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  fetchLotteryResults,
  addLotteryResult,
  updateLotteryResult,
  deleteLotteryResult,
  type DrawResult,
  DRAW_SCHEDULE,
} from "@/services/lotteryApi";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { PlusCircle, Edit, Trash2, Loader2, Search } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Skeleton } from "@/components/ui/skeleton";

const DrawResultSchema = z.object({
  draw_name: z.string().min(1, "Draw name is required"),
  date: z.date({ required_error: "Date is required" }),
  gagnants: z
    .string()
    .min(1, "Winning numbers are required")
    .regex(/^(\d{1,2})(,\s*\d{1,2}){4}$/, "Enter 5 numbers (1-90) separated by commas"),
  machine: z
    .string()
    .optional()
    .refine(
      (val) =>
        val === "" ||
        val === undefined ||
        /^(\d{1,2})(,\s*\d{1,2}){0,4}$/.test(val), // 0 to 5 numbers
      { message: "Enter up to 5 machine numbers (1-90) separated by commas, or leave blank" }
    ),
});

type DrawResultFormData = z.infer<typeof DrawResultSchema>;

const parseNumbersString = (numbersStr: string | undefined): number[] => {
  if (!numbersStr || numbersStr.trim() === "") return [];
  return numbersStr.split(",").map((n) => parseInt(n.trim(), 10)).filter(num => !isNaN(num) && num >= 1 && num <= 90);
};

export function AdminResultsManager() {
  const [results, setResults] = useState<DrawResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingResult, setEditingResult] = useState<DrawResult | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const form = useForm<DrawResultFormData>({
    resolver: zodResolver(DrawResultSchema),
  });

  const allDrawNames = Object.values(DRAW_SCHEDULE)
    .flatMap(daySchedule => Object.values(daySchedule))
    .filter((value, index, self) => self.indexOf(value) === index) // Unique names
    .sort();


  const loadResults = async () => {
    setIsLoading(true);
    try {
      const data = await fetchLotteryResults(); // Fetches all (potentially admin overridden)
      setResults(data);
    } catch (error) {
      toast({ variant: "destructive", title: "Error loading results", description: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadResults();
  }, []);

  const handleDialogOpen = (result?: DrawResult) => {
    form.reset();
    if (result) {
      setEditingResult(result);
      form.setValue("draw_name", result.draw_name);
      form.setValue("date", parseISO(result.date)); // Parse string date to Date object
      form.setValue("gagnants", result.gagnants.join(", "));
      form.setValue("machine", result.machine?.join(", ") || "");
    } else {
      setEditingResult(null);
    }
    setIsDialogOpen(true);
  };

  const onSubmit: SubmitHandler<DrawResultFormData> = async (data) => {
    setIsSubmitting(true);
    const resultData = {
      draw_name: data.draw_name,
      date: format(data.date, "yyyy-MM-dd"),
      gagnants: parseNumbersString(data.gagnants),
      machine: parseNumbersString(data.machine),
    };

    try {
      if (editingResult) {
        await updateLotteryResult({ ...resultData, id: editingResult.id });
        toast({ title: "Success", description: "Result updated successfully." });
      } else {
        await addLotteryResult(resultData);
        toast({ title: "Success", description: "Result added successfully." });
      }
      setIsDialogOpen(false);
      loadResults(); // Refresh list
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (resultId: string) => {
    try {
      await deleteLotteryResult(resultId);
      toast({ title: "Success", description: "Result deleted successfully." });
      loadResults(); // Refresh list
    } catch (error) {
      toast({ variant: "destructive", title: "Error", description: (error as Error).message });
    }
  };
  
  const filteredResults = results.filter(result => 
    result.draw_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.date.includes(searchTerm) ||
    result.gagnants.join(',').includes(searchTerm)
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Lottery Results</h2>
        <Button onClick={() => handleDialogOpen()}><PlusCircle className="mr-2 h-4 w-4" /> Add New Result</Button>
      </div>

       <div className="flex items-center gap-2">
         <Search className="h-5 w-5 text-muted-foreground" />
         <Input 
            type="text"
            placeholder="Search by draw name, date, or numbers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
       </div>


      {isLoading ? (
         <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Draw Name</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Winning Numbers</TableHead>
            <TableHead>Machine Numbers</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredResults.length > 0 ? filteredResults.map((result) => (
            <TableRow key={result.id}>
              <TableCell>{result.draw_name}</TableCell>
              <TableCell>{format(parseISO(result.date), "PPP")}</TableCell>
              <TableCell>{result.gagnants.join(", ")}</TableCell>
              <TableCell>{result.machine?.join(", ") || "N/A"}</TableCell>
              <TableCell className="space-x-2">
                <Button variant="outline" size="sm" onClick={() => handleDialogOpen(result)}>
                  <Edit className="h-4 w-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm"><Trash2 className="h-4 w-4" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the result.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(result.id)}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </TableCell>
            </TableRow>
          )) : (
             <TableRow>
                <TableCell colSpan={5} className="text-center">No results found.</TableCell>
             </TableRow>
          )}
        </TableBody>
      </Table>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{editingResult ? "Edit Result" : "Add New Result"}</DialogTitle>
            <DialogDescription>
              {editingResult ? "Modify the details of the lottery result." : "Enter the details for the new lottery result."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="draw_name">Draw Name</Label>
              <Controller
                name="draw_name"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <SelectTrigger id="draw_name">
                      <SelectValue placeholder="Select draw name" />
                    </SelectTrigger>
                    <SelectContent>
                      {allDrawNames.map(name => (
                        <SelectItem key={name} value={name}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.draw_name && <p className="text-sm text-destructive">{form.formState.errors.draw_name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Controller
                  name="date"
                  control={form.control}
                  render={({ field }) => (
                    <DatePicker date={field.value} setDate={field.onChange} className="w-full" />
                  )}
                />
              {form.formState.errors.date && <p className="text-sm text-destructive">{form.formState.errors.date.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gagnants">Winning Numbers (comma-separated)</Label>
              <Input id="gagnants" {...form.register("gagnants")} placeholder="e.g., 5, 12, 23, 34, 45" />
              {form.formState.errors.gagnants && <p className="text-sm text-destructive">{form.formState.errors.gagnants.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="machine">Machine Numbers (comma-separated, optional)</Label>
              <Input id="machine" {...form.register("machine")} placeholder="e.g., 1, 7 or leave blank" />
              {form.formState.errors.machine && <p className="text-sm text-destructive">{form.formState.errors.machine.message}</p>}
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingResult ? "Save Changes" : "Add Result"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
// Need to import Controller from react-hook-form
import { Controller } from "react-hook-form";

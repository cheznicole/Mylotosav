
'use server';
/**
 * @fileOverview Genkit flow to extract lottery data from an image using OCR.
 *
 * - extractLotteryDataFromImage - A function that processes an image and extracts lottery results.
 * - ExtractLotteryDataInput - The input type for the extractLotteryDataFromImage function.
 * - ExtractLotteryDataOutput - The return type for the extractLotteryDataFromImage function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ExtractLotteryDataInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of lottery results, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type ExtractLotteryDataInput = z.infer<typeof ExtractLotteryDataInputSchema>;

const ExtractedResultSchema = z.object({
  date: z.string().describe("Date of the draw, e.g., '19 mai 2025' or '28 avril 2025'. Preserve the exact format from the image."),
  winningNumbers: z.array(z.number()).length(5).describe("The 5 winning numbers, typically from '1er N° tiré' to '5ème N° tiré' columns."),
  machineNumbers: z.array(z.number()).length(5).describe("The 5 machine numbers, typically from '86ème N° tiré' to '90ème N° tiré' columns."),
});

const ExtractLotteryDataOutputSchema = z.object({
  drawName: z.string().describe("The name of the lottery draw extracted from the image header (e.g., 'Reveil' from a header like 'TIRAGE DE 10H REVEIL'). It should be just the draw name, not the full header text."),
  results: z.array(ExtractedResultSchema).describe("Array of extracted lottery results from the table rows."),
});
export type ExtractLotteryDataOutput = z.infer<typeof ExtractLotteryDataOutputSchema>;


export async function extractLotteryDataFromImage(
  input: ExtractLotteryDataInput
): Promise<ExtractLotteryDataOutput> {
  return extractLotteryDataFromImageFlow(input);
}

const extractPrompt = ai.definePrompt({
  name: 'extractLotteryDataPrompt',
  input: {schema: ExtractLotteryDataInputSchema},
  output: {schema: ExtractLotteryDataOutputSchema},
  prompt: `You are an OCR assistant specialized in extracting lottery results from images.
The provided image contains a table of lottery results.

Instructions:
1.  Identify the main title of the lottery draw from the image header. For example, if the header is "TIRAGE DE 10H REVEIL", the drawName is "Reveil". If it's "TIRAGE DE 13H ETOILE", the drawName is "Etoile". Extract only the specific name (e.g. Reveil, Etoile, Akwaba, Monday Special, etc.).
2.  The table has columns, typically including 'Date'. The winning numbers are usually labeled '1er N° tiré', '2ème N° tiré', '3ème N° tiré', '4ème N° tiré', '5ème N° tiré'.
3.  The machine numbers are usually labeled '86ème N° tiré', '87ème N° tiré', '88ème N° tiré', '89ème N° tiré', '90ème N° tiré'.
4.  Extract each row of data. For each row:
    - The 'date' should be extracted as a string exactly as it appears in the image (e.g., "19 mai 2025", "28 avril 2025").
    - The 'winningNumbers' must be an array of exactly 5 numbers corresponding to the first set of 5 drawn numbers.
    - The 'machineNumbers' must be an array of exactly 5 numbers corresponding to the second set of 5 drawn numbers (e.g., 86th to 90th).
5.  Return ALL extracted rows from the table. Do not summarize or omit any.
6.  Ensure the output strictly conforms to the JSON schema, with a top-level 'drawName' string and a 'results' array of objects.

Image to process:
{{media url=imageDataUri}}
`,
});

const extractLotteryDataFromImageFlow = ai.defineFlow(
  {
    name: 'extractLotteryDataFromImageFlow',
    inputSchema: ExtractLotteryDataInputSchema,
    outputSchema: ExtractLotteryDataOutputSchema,
  },
  async input => {
    // Note: If a 503 Service Unavailable error occurs here, it's an external API issue (model overloaded).
    // The application should catch this error in the calling component and inform the user to try again later.
    const {output} = await extractPrompt(input);
    if (!output) {
        throw new Error("AI failed to extract data from the image. The output was null or undefined.");
    }
    // Basic validation on AI output
    if (!output.drawName || typeof output.drawName !== 'string' || output.drawName.trim() === "") {
        throw new Error("AI output is missing a valid drawName. Please ensure the image is clear and contains valid lottery data.");
    }
    if (!output.results || !Array.isArray(output.results) || output.results.length === 0) {
        // It's possible an image has a draw name but no result rows, this might not always be an error.
        // However, for typical use, we expect some results.
        console.warn("AI output returned no result rows. DrawName:", output.drawName);
    }
    output.results.forEach((result, index) => {
        if(!result.winningNumbers || result.winningNumbers.length !== 5) {
            console.warn(`Potentially incomplete winningNumbers for result at index ${index} from AI:`, result.winningNumbers);
        }
        if(!result.machineNumbers || result.machineNumbers.length !== 5) {
             console.warn(`Potentially incomplete machineNumbers for result at index ${index} from AI:`, result.machineNumbers);
        }
    });
    return output;
  }
);


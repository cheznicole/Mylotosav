// This page might be removed or repurposed as a general landing/info page
// For now, redirecting to the first draw category, similar to home page.
import { redirect } from 'next/navigation';
import { getFirstDrawSlug } from '@/lib/utils';

export default function PredictPage() {
  const firstDrawSlug = getFirstDrawSlug();
  if (firstDrawSlug) {
    redirect(`/draw/${firstDrawSlug}`);
  }
  // If no draws, this will effectively be a 404 or loop if getFirstDrawSlug is empty
  // A more robust solution would be a dedicated landing page.
  return null;
}

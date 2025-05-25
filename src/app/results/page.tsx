// This page is now superseded by /draw/[drawSlug] with the "Données" tab.
// Redirecting to the first draw category for now.
import { redirect } from 'next/navigation';
import { getFirstDrawSlug } from '@/lib/utils';

export default function ResultsPage() {
  const firstDrawSlug = getFirstDrawSlug();
  if (firstDrawSlug) {
    redirect(`/draw/${firstDrawSlug}?tab=donnees`); // Attempt to go to data tab
  }
  return null;
}

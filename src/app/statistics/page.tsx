// This page is now superseded by /draw/[drawSlug] with the "Statistiques" tab.
// Redirecting to the first draw category for now.
import { redirect } from 'next/navigation';
import { getFirstDrawSlug } from '@/lib/utils';

export default function StatisticsPage() {
 const firstDrawSlug = getFirstDrawSlug();
  if (firstDrawSlug) {
    redirect(`/draw/${firstDrawSlug}?tab=statistiques`); // Attempt to go to stats tab
  }
  return null;
}

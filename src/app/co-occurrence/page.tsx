// This page is now superseded by /draw/[drawSlug] with the "Consulter" tab.
// Redirecting to the first draw category for now.
import { redirect } from 'next/navigation';
import { getFirstDrawSlug } from '@/lib/utils';

export default function CooccurrencePage() {
  const firstDrawSlug = getFirstDrawSlug();
  if (firstDrawSlug) {
    redirect(`/draw/${firstDrawSlug}?tab=consulter`); // Attempt to go to consulter tab
  }
  return null;
}

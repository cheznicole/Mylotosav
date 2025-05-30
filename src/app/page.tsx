
import { redirect } from 'next/navigation';
import { getFirstDrawSlug } from '@/lib/utils';

// General stability: Minor modification to ensure this page is re-evaluated.
export default function HomePage() {
  const firstDrawSlug = getFirstDrawSlug();
  if (firstDrawSlug) {
    redirect(`/draw/${firstDrawSlug}`);
  } else {
    // Fallback if no draws are defined, though unlikely with DRAW_SCHEDULE
    // Or redirect to a dedicated welcome/setup page if that existed
    redirect('/predict'); // Keep old redirect as a last resort
  }
  return null;
}


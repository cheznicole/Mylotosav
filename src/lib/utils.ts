import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

// Helper to find a draw name by its slug from DRAW_SCHEDULE
import { DRAW_SCHEDULE } from '@/services/lotteryApi'; // Assuming DRAW_SCHEDULE is exported

export function getDrawNameBySlug(slug: string): string | undefined {
  for (const daySchedule of Object.values(DRAW_SCHEDULE)) {
    for (const drawName of Object.values(daySchedule)) {
      if (slugify(drawName) === slug) {
        return drawName;
      }
    }
  }
  return undefined;
}

export function getFirstDrawSlug(): string {
  const firstDay = Object.keys(DRAW_SCHEDULE)[0];
  if (firstDay) {
    const firstTimeSlot = Object.keys(DRAW_SCHEDULE[firstDay])[0];
    if (firstTimeSlot) {
      const firstDrawName = DRAW_SCHEDULE[firstDay][firstTimeSlot];
      return slugify(firstDrawName);
    }
  }
  return ''; // Fallback
}

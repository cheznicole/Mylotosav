
export const getNumberColor = (number: number): { background: string; text: string } => {
  if (number >= 1 && number <= 9) return { background: 'bg-white', text: 'text-gray-800' }; // Blanc
  if (number >= 10 && number <= 19) return { background: 'bg-blue-700', text: 'text-white' }; // Bleu
  if (number >= 20 && number <= 29) return { background: 'bg-orange-500', text: 'text-white' }; // Orange
  if (number >= 30 && number <= 39) return { background: 'bg-green-600', text: 'text-white' }; // Vert
  if (number >= 40 && number <= 49) return { background: 'bg-yellow-500', text: 'text-gray-800' }; // Jaune
  if (number >= 50 && number <= 59) return { background: 'bg-pink-500', text: 'text-white' }; // Rose
  if (number >= 60 && number <= 69) return { background: 'bg-indigo-600', text: 'text-white' }; // Indigo
  if (number >= 70 && number <= 79) return { background: 'bg-amber-700', text: 'text-white' }; // Brun
  if (number >= 80 && number <= 90) return { background: 'bg-red-600', text: 'text-white' }; // Rouge
  return { background: 'bg-gray-200', text: 'text-gray-800' }; // Default for numbers outside specified range
};


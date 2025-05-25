export const getNumberColor = (number: number): { background: string; text: string } => {
  if (number >= 1 && number <= 9) return { background: 'bg-red-500', text: 'text-white' };
  if (number >= 10 && number <= 19) return { background: 'bg-yellow-400', text: 'text-gray-800' };
  if (number >= 20 && number <= 29) return { background: 'bg-blue-500', text: 'text-white' };
  if (number >= 30 && number <= 39) return { background: 'bg-orange-500', text: 'text-white' };
  if (number >= 40 && number <= 49) return { background: 'bg-green-500', text: 'text-white' };
  if (number >= 50 && number <= 59) return { background: 'bg-indigo-500', text: 'text-white' };
  if (number >= 60 && number <= 69) return { background: 'bg-purple-500', text: 'text-white' };
  if (number >= 70 && number <= 79) return { background: 'bg-pink-500', text: 'text-white' };
  if (number >= 80 && number <= 90) return { background: 'bg-gray-500', text: 'text-white' };
  return { background: 'bg-gray-200', text: 'text-gray-800' }; // Default for numbers outside range
};

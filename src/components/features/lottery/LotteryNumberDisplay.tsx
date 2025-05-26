
"use client";

import type { FC } from 'react';
import { getNumberColor } from '@/lib/lotteryUtils';
import { cn } from '@/lib/utils';

interface LotteryNumberDisplayProps {
  number: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LotteryNumberDisplay: FC<LotteryNumberDisplayProps> = ({ number, size = 'md', className }) => {
  const color = getNumberColor(number);
  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-semibold shadow-md',
        color.background,
        color.text,
        sizeClasses[size],
        className
      )}
      aria-label={`Lottery number ${number}`}
    >
      {number}
    </div>
  );
};

export default LotteryNumberDisplay;

import React from 'react';
import { Loader2 } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  onClick: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export const ActivateButton: React.FC<Props> = ({ onClick, isLoading, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled || isLoading}
    className={clsx(
      "flex w-full items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-zinc-900",
      (disabled || isLoading) && "cursor-not-allowed opacity-50 hover:bg-blue-600"
    )}
  >
    {isLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Обработка...
      </>
    ) : (
      'Активировать'
    )}
  </button>
);

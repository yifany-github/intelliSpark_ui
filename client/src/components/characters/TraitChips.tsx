import { useState } from 'react';

type Props = {
  traits: string[];
  maxVisible?: number; // number of chips to show before "+N more"
  size?: 'xs' | 'sm' | 'md';
  className?: string;
  chipClassName?: string; // override chip styling
  moreChipClassName?: string; // override "+N more" styling
};

const sizeClasses: Record<NonNullable<Props['size']>, string> = {
  xs: 'px-1.5 py-0.5 text-[10px]',
  sm: 'px-2 py-1 text-xs',
  md: 'px-3 py-1.5 text-sm',
};

export default function TraitChips({ traits = [], maxVisible = Infinity, size = 'sm', className = '', chipClassName, moreChipClassName }: Props) {
  const [expanded] = useState(false);
  const visible = traits.slice(0, maxVisible);
  const hiddenExists = traits.length > visible.length;

  return (
    <div className={`flex flex-nowrap gap-1 ${className}`}>
      {visible.map((trait, index) => (
        <span
          key={`${trait}-${index}`}
          className={`inline-flex items-center ${chipClassName || 'bg-gray-600 text-white'} rounded ${sizeClasses[size]}`}
        >
          {trait}
        </span>
      ))}
      {hiddenExists && (
        <span
          className={`inline-flex items-center ${moreChipClassName || 'bg-gray-700 text-white'} rounded ${sizeClasses[size]}`}
        >
          ...
        </span>
      )}
    </div>
  );
}

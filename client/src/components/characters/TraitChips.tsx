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
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? traits : traits.slice(0, maxVisible);
  const hiddenCount = Math.max(traits.length - visible.length, 0);

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {visible.map((trait, index) => (
        <span
          key={`${trait}-${index}`}
          className={`${chipClassName || 'bg-gray-600 text-white'} rounded ${sizeClasses[size]}`}
        >
          {trait}
        </span>
      ))}
      {!expanded && hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${moreChipClassName || 'bg-gray-700 hover:bg-gray-600 text-white'} rounded ${sizeClasses[size]}`}
          aria-label={`Show ${hiddenCount} more traits`}
          aria-expanded={expanded}
        >
          +{hiddenCount} more
        </button>
      )}
    </div>
  );
}

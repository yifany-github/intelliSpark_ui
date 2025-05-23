interface FilterChipProps {
  label: string;
  active?: boolean;
  withDropdown?: boolean;
  onClick?: () => void;
}

const FilterChip = ({ 
  label, 
  active = false, 
  withDropdown = false, 
  onClick 
}: FilterChipProps) => {
  return (
    <button
      className={`flex-shrink-0 px-4 py-2 rounded-full text-white mr-3 text-sm ${
        active ? "bg-primary" : "bg-secondary"
      }`}
      onClick={onClick}
    >
      {label}
      {withDropdown && <i className="fas fa-chevron-down ml-1 text-xs"></i>}
    </button>
  );
};

export default FilterChip;

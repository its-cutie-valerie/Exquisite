// src/contexts/FilterContext.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';

type FilterType = 'all' | 'status' | 'folder';

interface FilterState {
  type: FilterType;
  value: string | number | null;
  label: string;
}

interface FilterContextType {
  currentFilter: FilterState;
  setFilter: (type: FilterType, value: string | number | null, label: string) => void;
  clearFilter: () => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export const useFilter = () => {
  const context = useContext(FilterContext);
  if (!context) {
    throw new Error('useFilter must be used within a FilterProvider');
  }
  return context;
};

interface FilterProviderProps {
  children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
  const [currentFilter, setCurrentFilter] = useState<FilterState>({
    type: 'all',
    value: null,
    label: 'All Books'
  });

  const setFilter = (type: FilterType, value: string | number | null, label: string) => {
    setCurrentFilter({ type, value, label });
  };

  const clearFilter = () => {
    setCurrentFilter({
      type: 'all',
      value: null,
      label: 'All Books'
    });
  };

  return (
    <FilterContext.Provider value={{ currentFilter, setFilter, clearFilter }}>
      {children}
    </FilterContext.Provider>
  );
};

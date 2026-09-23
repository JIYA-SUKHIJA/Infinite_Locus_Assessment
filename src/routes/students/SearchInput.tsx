import React, { useState, useEffect, useRef } from 'react';
import styles from './StudentsView.module.css';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  debounceMs?: number;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  value: externalValue,
  onChange,
  debounceMs = 300,
  placeholder = 'Search students by name...'
}) => {
  const [internalValue, setInternalValue] = useState(externalValue);
  const isInitialMount = useRef(true);

  // Sync internal state if external value changes (e.g. via deep link or URL update)
  useEffect(() => {
    setInternalValue(externalValue);
  }, [externalValue]);

  // Debounce user typing before updating URL / parent query state
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (internalValue === externalValue) {
      return;
    }

    const timer = setTimeout(() => {
      onChange(internalValue);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [internalValue, externalValue, onChange, debounceMs]);

  const handleClear = () => {
    setInternalValue('');
    onChange('');
  };

  return (
    <div className={styles.searchWrapper}>
      <label htmlFor="student-search-input" className={styles.visuallyHidden}>
        Search students
      </label>
      <input
        id="student-search-input"
        type="search"
        role="searchbox"
        className={styles.searchInput}
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search students by name"
      />
      {internalValue.length > 0 && (
        <button
          type="button"
          onClick={handleClear}
          className={styles.clearSearchBtn}
          aria-label="Clear search input"
        >
          ✕
        </button>
      )}
    </div>
  );
};

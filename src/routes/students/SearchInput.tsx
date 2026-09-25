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
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Global Ctrl+K / Cmd+K shortcut listener (only intercepts if not already focused)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (document.activeElement !== inputRef.current) {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, []);

  const handleClear = () => {
    setInternalValue('');
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div className={styles.searchWrapper}>
      <label htmlFor="student-search-input" className={styles.visuallyHidden}>
        Search students
      </label>
      <div className={styles.searchIcon} aria-hidden="true">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>
      <input
        ref={inputRef}
        id="student-search-input"
        type="search"
        role="searchbox"
        className={styles.searchInput}
        value={internalValue}
        onChange={(e) => setInternalValue(e.target.value)}
        placeholder={placeholder}
        aria-label="Search students by name"
        aria-keyshortcuts="Control+k Meta+k"
      />
      {internalValue.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          className={styles.clearSearchBtn}
          aria-label="Clear search input"
        >
          ✕
        </button>
      ) : (
        <kbd className={styles.kbdHint} aria-hidden="true">
          Ctrl K
        </kbd>
      )}
    </div>
  );
};

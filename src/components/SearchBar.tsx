import { useEffect, useRef, useState } from "react";
import { Search, X, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/useDebounce";
import {
  clearSearchHistory,
  loadSearchHistory,
  recordSearchTerm,
} from "@/lib/search/searchHistory";

export interface SearchBarProps {
  /** Initial/controlled committed query (e.g. restored from URL state). */
  initialValue?: string;
  /** Fires with the debounced query (300ms) whenever it settles. */
  onSearch: (query: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

/**
 * #276 – Debounced marketplace search box with recent-search history and a
 * clear button. The raw input is debounced before it reaches `onSearch`, so
 * the catalog is only re-filtered once typing pauses.
 */
export function SearchBar({
  initialValue = "",
  onSearch,
  placeholder = "Search by title, description, creator, or tags...",
  debounceMs = 300,
}: SearchBarProps) {
  const [rawValue, setRawValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const debouncedValue = useDebounce(rawValue, debounceMs);

  // Load persisted history on mount.
  useEffect(() => {
    setHistory(loadSearchHistory());
  }, []);

  // Commit the debounced value upstream and record non-empty terms.
  useEffect(() => {
    onSearch(debouncedValue);
    const trimmed = debouncedValue.trim();
    if (trimmed) {
      setHistory(recordSearchTerm(trimmed));
    }
    // eslint-disable-next-line
  }, [debouncedValue]);

  const handleClear = () => {
    setRawValue("");
    onSearch("");
    inputRef.current?.focus();
  };

  const handlePickRecent = (term: string) => {
    setRawValue(term);
    setHistory(recordSearchTerm(term));
    setIsFocused(false);
    inputRef.current?.blur();
  };

  const handleClearHistory = () => {
    clearSearchHistory();
    setHistory([]);
  };

  // Show the recent-searches dropdown when focused with an empty input.
  const showHistory = isFocused && rawValue.trim() === "" && history.length > 0;

  return (
    <div className="relative flex-1 group">
      <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
      <Input
        ref={inputRef}
        value={rawValue}
        onChange={(e) => setRawValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        // Delay so a click on a dropdown row registers before it closes.
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        placeholder={placeholder}
        aria-label="Search prompts"
        data-shortcut="search"
        title="Search prompts ( / )"
        className="h-14 pl-12 pr-12 rounded-2xl border-white/5 bg-white/[0.03] text-base placeholder:text-slate-500 focus-visible:ring-emerald-500/20 transition-all"
      />
      {rawValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-xl text-slate-400 hover:text-white"
        >
          <X className="h-4 w-4" />
        </Button>
      )}

      {showHistory && (
        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between px-4 py-2 text-xs uppercase tracking-wide text-slate-500">
            <span>Recent searches</span>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleClearHistory}
              className="text-slate-400 hover:text-emerald-400 transition-colors"
            >
              Clear
            </button>
          </div>
          <ul>
            {history.map((term) => (
              <li key={term}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handlePickRecent(term)}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-slate-200 hover:bg-white/5 transition-colors"
                >
                  <Clock className="h-4 w-4 shrink-0 text-slate-500" />
                  <span className="truncate">{term}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default SearchBar;

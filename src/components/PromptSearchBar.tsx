interface Props {
  query: string;
  onChange: (q: string) => void;
  onRefresh: () => void;
}

export function PromptSearchBar({ query, onChange, onRefresh }: Props) {
  return (
    <div className="prompt-search-bar">
      <input
        className="prompt-search-input"
        type="search"
        placeholder="Search prompts…"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search prompt history"
      />
      <button
        className="prompt-search-refresh"
        onClick={onRefresh}
        aria-label="Refresh prompt history"
        title="Refresh"
      >
        ↻
      </button>
    </div>
  );
}

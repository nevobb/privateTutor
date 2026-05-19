export interface WebSearchHit {
  sourceId: string;
  title: string;
  snippet: string;
  url: string;
  stance: "supports" | "conflicts" | "neutral";
}

export interface WebSearchResult {
  query: string;
  hits: WebSearchHit[];
}

export interface WebSearchProvider {
  search(query: string): Promise<WebSearchResult>;
}

class MockWebSearchProvider implements WebSearchProvider {
  async search(query: string): Promise<WebSearchResult> {
    const normalized = query.toLowerCase();
    const conflict = /(controvers|conflict|debate|מחלוקת|סותר)/.test(normalized);

    const hits: WebSearchHit[] = [
      {
        sourceId: "web-1",
        title: "Public reference overview",
        snippet: "Widely cited summary from public sources.",
        url: "https://example.com/reference-overview",
        stance: "supports",
      },
      {
        sourceId: "web-2",
        title: conflict ? "Alternative interpretation" : "Supplementary context",
        snippet: conflict
          ? "Alternative source presents a conflicting claim for the same topic."
          : "Adds supporting context without contradicting the primary claim.",
        url: "https://example.com/alternative-context",
        stance: conflict ? "conflicts" : "neutral",
      },
    ];

    return {
      query,
      hits,
    };
  }
}

export const webSearchProvider: WebSearchProvider = new MockWebSearchProvider();

export function quoteRanges(text: string, quotes: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  for (const quote of [...new Set(quotes)].filter(Boolean)) {
    let offset = 0;
    while (offset < text.length) {
      const start = text.indexOf(quote, offset);
      if (start < 0) break;
      ranges.push({ start, end: start + quote.length });
      offset = start + quote.length;
    }
  }
  return ranges.sort((a, b) => a.start - b.start).reduce<Array<{ start: number; end: number }>>((merged, range) => {
    const previous = merged[merged.length - 1];
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
    return merged;
  }, []);
}

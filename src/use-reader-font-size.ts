import {useState} from 'react';

export const readerFontSizeKey = 'from-zero-to-gpt:reader-font-size';
export type ReaderFontSize = 'standard' | 'large' | 'largest';

function readFontSize(): ReaderFontSize {
  try {
    const saved = localStorage.getItem(readerFontSizeKey);
    if (saved === 'large' || saved === 'largest') return saved;
  } catch { /* Reading remains available when browser storage is blocked. */ }
  return 'standard';
}

// Keep this device preference separate from curriculum and learning backups.
// App owns the hook so even an unsaved choice survives chapter navigation.
export function useReaderFontSize() {
  const [size, setSize] = useState<ReaderFontSize>(readFontSize);
  const [saveError, setSaveError] = useState(false);
  function changeSize(next: ReaderFontSize) {
    setSize(next);
    try {
      localStorage.setItem(readerFontSizeKey, next);
      setSaveError(false);
    } catch {
      setSaveError(true);
    }
  }
  return {size, saveError, changeSize};
}

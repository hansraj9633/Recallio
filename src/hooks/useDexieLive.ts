import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';

export function useLiveQuery<T>(querier: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  const [value, setValue] = useState<T | undefined>(undefined);

  useEffect(() => {
    let active = true;
    const observable = liveQuery(querier);
    const subscription = observable.subscribe({
      next: (result) => {
        if (active) setValue(result);
      },
      error: (err) => {
        console.error('IndexedDB query error:', err);
      },
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return value;
}

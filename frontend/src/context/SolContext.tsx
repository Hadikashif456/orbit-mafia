import { createContext, useContext, useState, type FC, type ReactNode } from 'react';
import { DEFAULT_SOL } from '../lib/mission';

interface SolContextValue {
  sol: number;
  setSol: (sol: number | ((prev: number) => number)) => void;
}

const SolContext = createContext<SolContextValue | undefined>(undefined);

export const SolProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [sol, setSol] = useState<number>(DEFAULT_SOL);

  return (
    <SolContext.Provider value={{ sol, setSol }}>
      {children}
    </SolContext.Provider>
  );
};

export const useMissionSol = (): SolContextValue => {
  const context = useContext(SolContext);
  if (!context) {
    throw new Error('useMissionSol must be used within a SolProvider');
  }
  return context;
};

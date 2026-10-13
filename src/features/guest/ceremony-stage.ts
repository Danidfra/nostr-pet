/**
 * How the save ceremony's steps reach the living Blobbi (M14.2): a stage
 * handle in context, `react(moment)` and `attend(element)`. The portrait
 * itself is `CeremonyBlobbi.tsx`; its life is `useCeremonyLife.ts`.
 */
import { createContext, useContext } from 'react';
import type { CeremonyReaction } from './ceremony-life';

export interface CeremonyStage {
  react: (reaction: CeremonyReaction) => void;
  /** Where its eyes go while this element is the player's (a field being typed in); null lets them go. */
  attend: (element: HTMLElement | null) => void;
}

const noop: CeremonyStage = { react: () => {}, attend: () => {} };
export const CeremonyStageContext = createContext<CeremonyStage>(noop);

export function useCeremonyStage(): CeremonyStage {
  return useContext(CeremonyStageContext);
}

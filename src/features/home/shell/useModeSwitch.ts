/**
 * The switch between the two homes (M14.1): choosing is going there, and
 * the choice is the device's default from then on; the first 3D on a
 * device asks first (`ModeIntro`). See `ModeToggle.tsx`.
 */
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROOM_PATH, readRoomIntroSeen, useHomeExperience, writeRoomIntroSeen, type FromRoomState, type HomeExperience } from '@/lib/home-experience';

const BACK_HOME: FromRoomState = { fromRoom: true };

export interface ModeSwitch {
  mode: HomeExperience;
  /** Choose a home: go there and remember it; the first 3D asks first. */
  choose: (next: HomeExperience) => void;
  /** The introduction to 3D is open (the first time only). */
  introOpen: boolean;
  tryRoom: () => void;
  stayHome: () => void;
}

export function useModeSwitch(): ModeSwitch {
  const navigate = useNavigate();
  const [mode, setMode] = useHomeExperience();
  const [introOpen, setIntroOpen] = useState(false);
  const go = useCallback(
    (next: HomeExperience) => {
      setMode(next);
      if (next === 'room') navigate(ROOM_PATH);
      else navigate('/', { state: BACK_HOME });
    },
    [setMode, navigate],
  );
  const choose = useCallback(
    (next: HomeExperience) => {
      if (next === mode) return;
      if (next === 'room' && !readRoomIntroSeen()) {
        setIntroOpen(true);
        return;
      }
      go(next);
    },
    [mode, go],
  );
  const tryRoom = useCallback(() => {
    writeRoomIntroSeen();
    setIntroOpen(false);
    go('room');
  }, [go]);
  const stayHome = useCallback(() => {
    writeRoomIntroSeen();
    setIntroOpen(false);
  }, []);
  return { mode, choose, introOpen, tryRoom, stayHome };
}


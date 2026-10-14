/**
 * The switch between the two homes (M14.1): choosing is going there, and
 * the choice is the device's default from then on. The room greets a
 * first visit with its introduction itself (`RoomIntro`, shown by the room
 * page when `readRoomIntroSeen()` is false; M14.2), so the switch asks
 * nothing. See `ModeToggle.tsx`.
 */
import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROOM_PATH, useHomeExperience, type FromRoomState, type HomeExperience } from '@/lib/home-experience';

const BACK_HOME: FromRoomState = { fromRoom: true };

export interface ModeSwitch {
  mode: HomeExperience;
  /** Choose a home: go there and remember it. */
  choose: (next: HomeExperience) => void;
}

export function useModeSwitch(): ModeSwitch {
  const navigate = useNavigate();
  const [mode, setMode] = useHomeExperience();
  const choose = useCallback(
    (next: HomeExperience) => {
      if (next === mode) return;
      setMode(next);
      if (next === 'room') navigate(ROOM_PATH);
      else navigate('/', { state: BACK_HOME });
    },
    [mode, setMode, navigate],
  );
  return { mode, choose };
}

/**
 * The sound registry: four short effects for the moments that deserve one.
 * Files are the old app's own, recovered from Git history.
 */
export type SoundId = 'eat' | 'clean' | 'rest' | 'celebrate';

export const SOUND_FILES: Record<SoundId, string> = {
  eat: '/sounds/eating.mp3',
  clean: '/sounds/cleaning.mp3',
  rest: '/sounds/tired.mp3',
  celebrate: '/sounds/correct-choice.mp3',
};

export const SOUND_STORAGE_KEY = 'blobbi:sound:v1';

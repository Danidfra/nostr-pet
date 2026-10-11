/**
 * The Blobbi's sound vocabulary: a few short creature noises, all made of
 * the same building blocks (see `blobbi-voice.ts`), so they sound like one
 * small creature and not like notifications. Gameplay asks for one of
 * these by meaning; what it sounds like is the voice's business.
 */
export type BlobbiSoundId =
  | 'eat'
  | 'clean'
  | 'poke'
  | 'happy'
  | 'excited'
  | 'upset'
  | 'sleepy'
  | 'hatch'
  | 'evolve'
  // The room's own, softer still: what the player's hands do (choose, pick up, set down), the room answering
  | 'drink'
  | 'select'
  | 'pickup'
  | 'drop'
  | 'room'
  | 'knock'
  | 'place'
  | 'save'
  | 'invalid'
  // A Blobbi travelling, cue by cue: gathering itself and rising away; coming down and settling, then glad
  | 'gather'
  | 'rise'
  | 'descend'
  | 'tada';

export const BLOBBI_SOUNDS: readonly BlobbiSoundId[] = ['eat', 'clean', 'poke', 'happy', 'excited', 'upset', 'sleepy', 'hatch', 'evolve', 'drink', 'select', 'pickup', 'drop', 'room', 'knock', 'place', 'save', 'invalid', 'gather', 'rise', 'descend', 'tada'];

/** @deprecated kept as an alias for the vocabulary type; the files are gone. */
export type SoundId = BlobbiSoundId;

export const SOUND_STORAGE_KEY = 'blobbi:sound:v1';

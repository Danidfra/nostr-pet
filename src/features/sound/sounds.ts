/**
 * The Blobbi's sound vocabulary: a few short creature noises, all made of
 * the same building blocks (see `blobbi-voice.ts`), so they sound like one
 * small creature and not like notifications. Gameplay asks for one of
 * these by meaning; what it sounds like is the voice's business.
 *
 * The voice (what the Blobbi itself says): curious, glad, excited, enjoying
 * food (a bite, and the satisfied hum after), enjoying being petted (the
 * purr), playful (a chirp), surprised, sleepy, displeased. The room's own
 * sounds (what the player's hands and the furniture do, a ball struck) are
 * quieter and plainer, so they never compete with it.
 */
export type BlobbiSoundId =
  // The voice
  | 'curious'
  | 'poke'
  | 'happy'
  | 'excited'
  | 'chirp'
  | 'bite'
  | 'eat'
  | 'yum'
  | 'pet'
  | 'upset'
  | 'sleepy'
  | 'surprise'
  | 'hatch'
  | 'evolve'
  | 'clean'
  | 'drink'
  // The room's own, softer still: what the player's hands do (choose, pick up, set down), the room answering
  | 'select'
  | 'pickup'
  | 'drop'
  | 'room'
  | 'knock'
  | 'place'
  | 'save'
  | 'invalid'
  // A ball struck, and landing
  | 'kick'
  | 'bounce'
  // A Blobbi travelling, cue by cue: gathering itself and rising away; coming down and settling, then glad
  | 'gather'
  | 'rise'
  | 'descend'
  | 'tada'
  // Its moments in a room transition
  | 'crouch'
  | 'jump'
  | 'land'
  | 'fall'
  | 'peek';

export const BLOBBI_SOUNDS: readonly BlobbiSoundId[] = [
  'curious', 'poke', 'happy', 'excited', 'chirp', 'bite', 'eat', 'yum', 'pet', 'upset', 'sleepy', 'surprise', 'hatch', 'evolve', 'clean', 'drink',
  'select', 'pickup', 'drop', 'room', 'knock', 'place', 'save', 'invalid', 'kick', 'bounce',
  'gather', 'rise', 'descend', 'tada', 'crouch', 'jump', 'land', 'fall', 'peek',
];

/** The sounds the Blobbi makes itself (its voice), as against the room's. */
export const VOICE_SOUNDS: readonly BlobbiSoundId[] = ['curious', 'poke', 'happy', 'excited', 'chirp', 'bite', 'eat', 'yum', 'pet', 'upset', 'sleepy', 'surprise', 'hatch', 'evolve', 'clean', 'drink', 'tada', 'crouch', 'jump', 'fall', 'peek', 'gather', 'rise', 'descend'];

/** @deprecated kept as an alias for the vocabulary type; the files are gone. */
export type SoundId = BlobbiSoundId;

export const SOUND_STORAGE_KEY = 'blobbi:sound:v1';

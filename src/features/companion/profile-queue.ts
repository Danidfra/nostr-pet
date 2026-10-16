/**
 * One profile write at a time, per account: the kit's `profileWriteQueue`
 * (`@blobbi-kit/core`), the one instance for the whole page. The profile
 * (kind 11125) is replaceable: two writes of this page out at once would each
 * be built over the profile before the other, and the later one would undo
 * the earlier (a daily-progress save undoing a companion choice made a second
 * before). Every profile write this home makes runs in it: the companion
 * choice (`companion-sync.ts`), and through `writeProfileSafely` adoption's
 * profile, the daily award and the daily progress (the kit's
 * `usePersistDailyProgress` safe mode). Accounts never wait for each other.
 */
import { profileWriteQueue } from '@blobbi-kit/core';

export const profileQueue = profileWriteQueue;

/**
 * One profile write at a time, per account. The profile (kind 11125) is
 * replaceable: two writes of this page out at once would each be built over
 * the profile before the other, and the later one would undo the earlier
 * (a daily award undoing a companion choice made a second before). Every
 * write this home builds itself goes through here: the companion choice,
 * adoption's profile, the daily award. Accounts never wait for each other.
 */
const tails = new Map<string, Promise<unknown>>();

export const profileQueue = {
  /** Run `job` after every write already queued for `account`; a failed job never blocks the next. */
  run<T>(account: string, job: () => Promise<T>): Promise<T> {
    const before = tails.get(account) ?? Promise.resolve();
    const mine = before.then(job, job);
    const tail = mine.then(
      () => undefined,
      () => undefined,
    );
    tails.set(account, tail);
    void tail.then(() => {
      if (tails.get(account) === tail) tails.delete(account);
    });
    return mine;
  },
};

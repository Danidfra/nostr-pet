import type { en } from './messages/en';

/** The shape of a message tree with every string widened: what a translation must provide. */
export type MessageShape<T> = { [K in keyof T]: T[K] extends string ? string : MessageShape<T[K]> };

/** Every language's messages have exactly the English tree's shape. */
export type Messages = MessageShape<typeof en>;

type Leaves<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Leaves<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** A dotted path to one message, e.g. `'menu.sound.title'`. */
export type MessageKey = Leaves<typeof en>;

/**
 * A key that has plural forms: the message exists as `<key>_one` and
 * `<key>_other` (and, where a language needs them, `_zero`, `_two`, `_few`,
 * `_many`), and `tp(key, count)` picks the form the language's rules ask for.
 */
export type PluralKey = MessageKey extends infer K ? (K extends `${infer Base}_other` ? Base : never) : never;

/** Values put into a message's `{placeholders}`. */
export type MessageParams = Record<string, string | number>;

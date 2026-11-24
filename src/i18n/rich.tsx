import { Fragment, type ReactNode } from 'react';
import { t } from './t';
import type { MessageKey } from './types';

/**
 * A message with React nodes in its `{placeholders}` (a bold name, a link),
 * so a translation can move them anywhere in the sentence:
 * `tRich('home.welcome', { name: <strong>{blobbi.name}</strong> })`.
 * Plain values may be passed too.
 */
export function tRich(key: MessageKey, nodes: Record<string, ReactNode>): ReactNode {
  const message = t(key);
  const parts = message.split(/(\{\w+\})/g);
  return parts.map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    if (name && name in nodes) return <Fragment key={i}>{nodes[name]}</Fragment>;
    return part ? <Fragment key={i}>{part}</Fragment> : null;
  });
}

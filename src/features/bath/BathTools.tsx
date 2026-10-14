/**
 * The three tools of the bath, drawn: a bar of soap, a shower head, a towel.
 * One drawing each, used small in the tool bar and following the pointer
 * over the Blobbi. Plain SVG in a 64 × 64 box, no text, nothing animated
 * here (the stylesheet moves them).
 */
import type { BathTool } from './bath-machine';

export function BathToolArt({ tool, className }: { tool: BathTool; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden focusable="false">
      {tool === 'soap' && <SoapArt />}
      {tool === 'shower' && <ShowerArt />}
      {tool === 'towel' && <TowelArt />}
    </svg>
  );
}

function SoapArt() {
  return (
    <g>
      <rect x="8" y="20" width="48" height="28" rx="10" fill="#f9a8d4" stroke="#be185d" strokeWidth="2.5" />
      <rect x="14" y="25" width="22" height="7" rx="3.5" fill="#fff" opacity="0.7" />
      <circle cx="44" cy="16" r="5" fill="#fff" stroke="#93c5fd" strokeWidth="1.5" opacity="0.95" />
      <circle cx="54" cy="10" r="3" fill="#fff" stroke="#93c5fd" strokeWidth="1.2" opacity="0.9" />
      <circle cx="36" cy="10" r="2.2" fill="#fff" stroke="#93c5fd" strokeWidth="1" opacity="0.85" />
    </g>
  );
}

function ShowerArt() {
  return (
    <g>
      <path d="M32 6 C 32 6, 46 6, 48 14" fill="none" stroke="#64748b" strokeWidth="4" strokeLinecap="round" />
      <rect x="29" y="4" width="6" height="22" rx="3" fill="#94a3b8" stroke="#475569" strokeWidth="1.5" />
      <ellipse cx="32" cy="32" rx="22" ry="8" fill="#cbd5e1" stroke="#475569" strokeWidth="2" />
      <ellipse cx="32" cy="34" rx="17" ry="4.5" fill="#64748b" opacity="0.5" />
      {[-12, -6, 0, 6, 12].map((dx) => (
        <circle key={dx} cx={32 + dx} cy="34" r="1.3" fill="#1e293b" />
      ))}
      {[-11, -4, 4, 11].map((dx, i) => (
        <path key={dx} d={`M${32 + dx} 42 q ${dx * 0.08} 8 ${dx * 0.15} 16`} fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinecap="round" opacity={0.6 + (i % 2) * 0.3} />
      ))}
    </g>
  );
}

function TowelArt() {
  return (
    <g>
      <path d="M10 14 h 40 a 6 6 0 0 1 6 6 v 24 a 6 6 0 0 1 -6 6 h -40 a 6 6 0 0 1 -6 -6 v -24 a 6 6 0 0 1 6 -6 z" fill="#fef3c7" stroke="#b45309" strokeWidth="2.5" />
      <path d="M10 14 h 40 a 6 6 0 0 1 6 6 v 8 h -52 v -8 a 6 6 0 0 1 6 -6 z" fill="#fde68a" opacity="0.8" />
      <rect x="6" y="32" width="52" height="3" fill="#f59e0b" opacity="0.75" />
      <rect x="6" y="38" width="52" height="3" fill="#f59e0b" opacity="0.5" />
      <path d="M12 50 q 8 -6 16 0 q 8 6 16 0 q 6 -4 10 0" fill="none" stroke="#b45309" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
    </g>
  );
}

import React from 'react';
export function Wave({ small = false }: { small?: boolean }) { return <svg className={small ? 'wave small' : 'wave'} viewBox="0 0 50 24" aria-hidden="true"><path d="M3 15C10 2 15 3 20 13S31 23 36 11 44 5 47 10M5 20c6-7 10-4 13 0" /></svg>; }
export function DragHandle({ children, className = '' }: { children?: React.ReactNode; className?: string }) {
  return <div className={`drag-handle ${className}`} title="按住拖动挂件" onPointerDown={e => { if (e.button !== 0 || (e.target as HTMLElement).closest('button')) return; e.currentTarget.setPointerCapture(e.pointerId); void window.modeltide.action('drag-start'); }} onPointerUp={e => { e.currentTarget.releasePointerCapture(e.pointerId); void window.modeltide.action('drag-end'); }} onPointerCancel={() => void window.modeltide.action('drag-end')}>{children}</div>;
}

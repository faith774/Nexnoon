import type { ComponentProps } from 'react';
import {
  btn as studioBtn,
  inputCls as studioInputCls,
  EmptyBlock as StudioEmptyBlock,
  FilterChips as StudioFilterChips,
  Modal as StudioModal,
  Pill as StudioPill,
  StatTile as StudioStatTile,
} from '../studio/ui';

export { SectionLabel, SegmentedTabs } from '../studio/ui';

/* Learner-facing versions of the studio primitives, rounded to match the public site. */

export const btn = {
  primary: `${studioBtn.primary} rounded-full font-medium`,
  accent: `${studioBtn.accent} rounded-full font-medium`,
  secondary: `${studioBtn.secondary} rounded-full`,
  danger: `${studioBtn.danger} rounded-full`,
  link: studioBtn.link,
};

export const inputCls = `${studioInputCls} rounded-xl`;

export const card = 'overflow-hidden rounded-2xl border border-[#ebe6de] bg-white';

export function Pill({ className = '', ...props }: ComponentProps<typeof StudioPill>) {
  return <StudioPill {...props} className={`rounded-full ${className}`} />;
}

export function EmptyBlock({ className = '', ...props }: ComponentProps<typeof StudioEmptyBlock>) {
  return <StudioEmptyBlock {...props} className={`rounded-2xl ${className}`} />;
}

export function StatTile({ className = '', ...props }: ComponentProps<typeof StudioStatTile>) {
  return <StudioStatTile {...props} className={`rounded-2xl ${className}`} />;
}

export function FilterChips<T extends string>(props: ComponentProps<typeof StudioFilterChips<T>>) {
  return <StudioFilterChips<T> {...props} chipClassName={`rounded-full ${props.chipClassName ?? ''}`} />;
}

export function Modal(props: ComponentProps<typeof StudioModal>) {
  return <StudioModal {...props} panelClassName={`overflow-hidden rounded-t-3xl sm:rounded-3xl ${props.panelClassName ?? ''}`} />;
}

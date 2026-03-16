/**
 * Framer Motion animation presets for Ops OS.
 * Linear-inspired: fast (100-200ms), functional, no bounce/spring.
 */

/** Simple fade in — 150ms */
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
}

/** Fade in with subtle upward slide — 150ms, 4px */
export const slideUp = {
  initial: { opacity: 0, y: 4 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: 2 },
  transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
}

/** Scale in for modals/dialogs — 120ms, from 0.97 */
export const scaleIn = {
  initial: { opacity: 0, scale: 0.97 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.97 },
  transition: { duration: 0.12, ease: [0.25, 0.1, 0.25, 1] },
}

/** Container that staggers its children — 30ms delay */
export const staggerContainer = {
  initial: 'initial',
  animate: 'animate',
  variants: {
    initial: {},
    animate: {
      transition: {
        staggerChildren: 0.03,
      },
    },
  },
}

/** Individual stagger item */
export const staggerItem = {
  variants: {
    initial: { opacity: 0, y: 4 },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.15, ease: [0.25, 0.1, 0.25, 1] },
    },
  },
}

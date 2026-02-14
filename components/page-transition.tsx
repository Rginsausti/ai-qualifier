"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, useReducedMotion } from "motion/react";
import * as m from "motion/react-m";

export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={pathname}
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reducedMotion ? { opacity: 1 } : { opacity: 0, y: -4 }}
            transition={{ duration: reducedMotion ? 0.01 : 0.24, ease: [0, 0, 0.2, 1] }}
          >
            {children}
          </m.div>
        </AnimatePresence>
      </LazyMotion>
    </MotionConfig>
  );
}

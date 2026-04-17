"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface StaggerListProps {
  children: ReactNode;
  className?: string;
  staggerDelay?: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 4 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.08, ease: [0.16, 1, 0.3, 1] as const },
  },
};

export function StaggerList({
  children,
  className,
  staggerDelay = 0.04,
}: StaggerListProps) {
  const variants = {
    ...container,
    show: {
      ...container.show,
      transition: { staggerChildren: staggerDelay },
    },
  };

  return (
    <motion.div
      variants={variants}
      initial="hidden"
      animate="show"
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={item} className={className}>
      {children}
    </motion.div>
  );
}

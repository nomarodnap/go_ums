"use client";

import * as React from "react";
import { motion, type HTMLMotionProps, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

interface MotionContainerProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export function MotionContainer({
  children,
  className,
  delay = 0,
  ...props
}: MotionContainerProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      transition={{ delay }}
      className={cn("w-full", className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

interface MotionItemProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
}

export function MotionItem({ children, className, ...props }: MotionItemProps) {
  return (
    <motion.div variants={itemVariants} className={cn(className)} {...props}>
      {children}
    </motion.div>
  );
}

interface MotionCardProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  className?: string;
  enableHover?: boolean;
}

export function MotionCard({
  children,
  className,
  enableHover = true,
  ...props
}: MotionCardProps) {
  return (
    <motion.div
      variants={itemVariants}
      whileHover={
        enableHover
          ? {
              y: -3,
              transition: { duration: 0.2, ease: "easeOut" },
            }
          : undefined
      }
      whileTap={enableHover ? { scale: 0.99 } : undefined}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}

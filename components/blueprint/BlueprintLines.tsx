"use client";
import { motion } from "framer-motion";

export default function BlueprintLines({ className }: { className?: string }) {
  return (
    <motion.svg
      className={`${className} opacity-25`}
      viewBox="0 0 400 250"
      initial="hidden"
      animate="visible"
    >
      {/* same SVG paths you already have */}
    </motion.svg>
  );
}

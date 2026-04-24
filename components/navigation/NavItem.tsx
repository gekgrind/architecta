"use client";
import { motion } from "framer-motion";
import type { ComponentType, SVGProps } from "react";

type NavItemProps = {
  name: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  isActive?: boolean;
  onClick: () => void;
};

export default function NavItem({ name, icon: Icon, onClick }: NavItemProps) {
  return (
    <motion.button onClick={onClick}>
      <Icon className="w-5 h-5" />
      {name}
    </motion.button>
  );
}

"use client";
import NavItem from "@/components/navigation/NavItem";
import { Icons } from "@/components/icons";

type SidebarProps = {
  activeNav: string;
  setActiveNav: (value: string) => void;
};

export default function Sidebar({ activeNav, setActiveNav }: SidebarProps) {
  const navItems = [
    { name: "Dashboard", icon: Icons.Dashboard },
    { name: "Generate", icon: Icons.Generate },
  ];

  return (
    <aside>
      {navItems.map(item => (
        <NavItem
          key={item.name}
          {...item}
          isActive={activeNav === item.name}
          onClick={() => setActiveNav(item.name)}
        />
      ))}
    </aside>
  );
}

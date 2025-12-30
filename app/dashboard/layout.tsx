
import ArchitectaPrismBackground from "@/components/backgrounds/ArchitectaPrismBackground";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 -z-10">
        <ArchitectaPrismBackground preset="dashboard" />
      </div>
      {children}
    </div>
  );
}-
0
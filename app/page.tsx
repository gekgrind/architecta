import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProblemSection from "@/components/landing/ProblemSection";
import SolutionSection from "@/components/landing/SolutionSection";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import AudienceSection from "@/components/landing/AudienceSection";
import EcosystemSection from "@/components/landing/EcosystemSection";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <ProblemSection />
      <SolutionSection />
      <Features />
      <HowItWorks />
      <AudienceSection />
      <EcosystemSection />
      <CTASection />
      <Footer />
    </main>
  );
}

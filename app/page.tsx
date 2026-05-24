import Navbar from "@/components/Homepage/Navbar";
import Hero from "@/components/Homepage/Hero";
import Features from "@/components/Homepage/Features";
import Benefits from "@/components/Homepage/Benefits";
import Footer from "@/components/Homepage/Footer";

const HomePage = () => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Background Glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-125 w-125 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      {/* Navbar */}
      <Navbar />

      {/* Hero */}
      <Hero />

      {/* Features */}
      <Features />

      {/* Benefits */}
      <Benefits />

      {/* Footer */}
      <Footer />
    </div>
  );
};

export default HomePage;

import Navbar from "@/components/Homepage/Navbar";
import Hero from "@/components/Homepage/Hero";
import Features from "@/components/Homepage/Features";
import Benefits from "@/components/Homepage/Benefits";
import Footer from "@/components/Homepage/Footer";


const HomePage = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Navbar Section */}
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Features Section */}
      <Features />

      {/* Benefits Section*/}
      <Benefits />

      {/* Footer Section*/}
      <Footer />
    </div>
  );
};

export default HomePage;

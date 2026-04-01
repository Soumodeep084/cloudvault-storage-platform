import { benefits } from "@/lib/homeData";
import { CheckCircle2 } from "lucide-react";

const Benefits = () => {
  return (
    <section className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-6">
              Built for security & reliability
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Your files deserve the best protection. CloudVault uses
              industry-leading encryption and redundancy to keep your data safe.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {benefits.map((b) => (
                <div key={b} className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <span className="text-sm font-medium">{b}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-linear-to-br from-primary/10 to-primary/5 rounded-2xl p-8 border border-primary/20">
            <div className="space-y-4">
              {[
                { label: "Files Protected", value: "2.4M+" },
                { label: "Active Users", value: "50K+" },
                { label: "Uptime", value: "99.99%" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex justify-between items-center p-4 bg-card rounded-lg"
                >
                  <span className="text-muted-foreground">{stat.label}</span>
                  <span className="text-2xl font-bold text-primary">
                    {stat.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;

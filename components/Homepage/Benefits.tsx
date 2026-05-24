import { benefits } from "@/lib/homeData";
import { CheckCircle2 } from "lucide-react";

const Benefits = () => {
  return (
    <section className="py-24">
      <div className="mx-auto grid max-w-7xl items-center gap-16 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
        {/* Left */}
        <div>
          <h2 className="mb-6 text-3xl font-bold">Simple. Secure. Reliable.</h2>

          <p className="mb-8 text-lg text-muted-foreground">
            CloudVault helps you securely manage your files with protected
            storage and an easy-to-use dashboard experience.
          </p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {benefits.map((b) => (
              <div
                key={b}
                className="flex items-center gap-3 rounded-lg border border-border bg-card/50 p-4"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />

                <span className="text-sm font-medium">{b}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="rounded-3xl border border-primary/20 bg-linear-to-br from-primary/10 to-primary/5 p-8">
          <div className="space-y-4">
            {[
              {
                label: "Secure Upload System",
                value: "Enabled",
              },
              {
                label: "User File Dashboard",
                value: "Available",
              },
              {
                label: "Protected Storage",
                value: "Active",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex items-center justify-between rounded-xl bg-background p-5 shadow-sm"
              >
                <span className="text-muted-foreground">{stat.label}</span>

                <span className="text-lg font-bold text-primary">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;

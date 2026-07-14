import { AccessGate } from "@/components/access-gate";
import { Dashboard } from "@/components/dashboard";
import { hasValidSession, isAccessKeyConfigured } from "@/lib/auth";

export default async function Home() {
  if (!(await hasValidSession())) {
    return <AccessGate isConfigured={isAccessKeyConfigured()} />;
  }

  return <Dashboard />;
}

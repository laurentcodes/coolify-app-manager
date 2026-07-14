"use client";

import { ArrowRight as arrowRight, KeyRound as keyRound, ShieldCheck as shieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ApiMessage } from "@/lib/types";
import type { FormEvent } from "react";

export function AccessGate({ isConfigured }: { isConfigured: boolean }) {
  const ArrowRight = arrowRight;
  const Key = keyRound;
  const Shield = shieldCheck;
  const router = useRouter();
  const [key, setKey] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key }),
      });
      const body = (await response.json()) as ApiMessage;
      if (!response.ok) throw new Error(body.message);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Access could not be verified.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="auth-page">
      <div className="auth-glow" />
      <section className="auth-card" aria-labelledby="access-title">
        <div className="auth-mark"><Shield size={20} /></div>
        <span className="utility-label">Private console</span>
        <h1 id="access-title">Enter Coolify Manager</h1>
        <p>Use the private access key configured for this dashboard.</p>

        {isConfigured ? (
          <form onSubmit={authenticate}>
            <label htmlFor="access-key">Access key</label>
            <div className="auth-input-wrap">
              <Key size={17} />
              <input
                id="access-key"
                name="access-key"
                type="password"
                value={key}
                onChange={(event) => setKey(event.target.value)}
                placeholder="Paste your access key"
                autoComplete="current-password"
                autoFocus
                required
              />
            </div>
            {error ? <div className="auth-error" role="alert">{error}</div> : null}
            <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Verifying…" : "Continue"} <ArrowRight size={16} />
            </button>
          </form>
        ) : (
          <div className="setup-note">
            <strong>Access key required</strong>
            <span>Add <code>DASHBOARD_ACCESS_KEY</code> to your environment, then restart the app.</span>
          </div>
        )}

        <small>Sessions expire after seven days. Rotating the key signs out every session.</small>
      </section>
    </main>
  );
}

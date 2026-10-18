"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { browserSupportsWebAuthn, platformAuthenticatorIsAvailable, startAuthentication, startRegistration } from "@simplewebauthn/browser";
import { addPasskeyAction, passkeyRegistrationOptionsAction, passkeySignInAction, passkeySignInOptionsAction } from "@/app/actions/passkeys";

// Cancelling the fingerprint prompt, or a timeout, both arrive as NotAllowedError.
function cancelled(e: unknown) {
  return e instanceof Error && (e.name === "NotAllowedError" || e.name === "AbortError");
}

function usePlatformAuthenticator() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (browserSupportsWebAuthn()) platformAuthenticatorIsAvailable().then(setAvailable, () => setAvailable(false));
  }, []);
  return available;
}

export function FingerprintSignIn({ kiosk, next }: { kiosk?: boolean; next?: string }) {
  const available = usePlatformAuthenticator();
  const router = useRouter();
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  if (!available) return null;

  function signIn() {
    setError(undefined);
    startTransition(async () => {
      try {
        const optionsJSON = await passkeySignInOptionsAction();
        const response = await startAuthentication({ optionsJSON });
        const result = await passkeySignInAction(response, { kiosk, next });
        if ("error" in result) setError(result.error);
        else router.replace(result.next);
      } catch (e) {
        setError(cancelled(e) ? "Fingerprint sign-in was cancelled. Try again, or use your password below." : "Fingerprint sign-in didn't work on this device. Please use your password.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      <button type="button" className="btn btn-primary btn-lg w-full" onClick={signIn} disabled={pending} aria-disabled={pending}>
        {pending ? "Waiting for your fingerprint…" : "Sign in with fingerprint"}
      </button>
      <p className="hint text-center">Or sign in with your email and password.</p>
    </div>
  );
}

export function AddFingerprint() {
  const available = usePlatformAuthenticator();
  const [error, setError] = useState<string>();
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!available) {
    return <p className="muted">This device can&apos;t do fingerprint sign-in, or no fingerprint or screen lock is set up on it.</p>;
  }

  // onSubmit rather than a form action, so a wrong password doesn't clear the device name.
  function add(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setError(undefined);
    setDone(false);
    startTransition(async () => {
      try {
        const result = await passkeyRegistrationOptionsAction(String(form.get("password") ?? ""));
        if ("error" in result) return setError(result.error);
        const response = await startRegistration({ optionsJSON: result.options });
        const saved = await addPasskeyAction(response, String(form.get("deviceName") ?? ""));
        if (saved.error) setError(saved.error);
        else setDone(true);
      } catch (e) {
        if (e instanceof Error && e.name === "InvalidStateError") setError("Fingerprint sign-in is already set up for you on this device.");
        else setError(cancelled(e) ? "Setting up was cancelled. Please try again." : "Fingerprint sign-in could not be set up on this device.");
      }
    });
  }

  return (
    <form onSubmit={add} className="space-y-5">
      {error && <div className="alert alert-error" role="alert">{error}</div>}
      {done && <div className="alert alert-success" role="status">Done. Next time, tap &quot;Sign in with fingerprint&quot; on this device.</div>}
      <label className="field" htmlFor="deviceName">
        <span className="label">Name for this device</span>
        <input id="deviceName" name="deviceName" className="input" maxLength={60} placeholder="For example: Reception tablet" autoComplete="off" />
      </label>
      <label className="field" htmlFor="passkey-password">
        <span className="label">Your password, to confirm it&apos;s you</span>
        <input id="passkey-password" name="password" type="password" className="input" autoComplete="off" required />
      </label>
      <button type="submit" className="btn btn-primary" disabled={pending} aria-disabled={pending}>
        {pending ? "Waiting for your fingerprint…" : "Set up fingerprint sign-in"}
      </button>
    </form>
  );
}

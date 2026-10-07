import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { api, ApiError } from "../api";
import { setPresenterToken } from "../auth";

export default function Login() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") ?? "/create";

  const [passcodeEnabled, setPasscodeEnabled] = useState(false);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [passcode, setPasscode] = useState("");
  const [email, setEmail] = useState("");
  const [pinSent, setPinSent] = useState(false);
  const [pin, setPin] = useState("");

  useEffect(() => {
    api
      .getConfig()
      .then((cfg) => {
        setPasscodeEnabled(cfg.passcodeEnabled);
        setEmailEnabled(cfg.emailEnabled);
      })
      .catch(() => setError("Could not load login configuration."));
  }, []);

  const loginPasscode = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.loginPasscode(passcode);
      setPresenterToken(res.token);
      navigate(next);
    } catch (err) {
      setError(
        err instanceof ApiError && err.message === "too_many_attempts"
          ? "Too many attempts — try again in a few minutes."
          : "Wrong passcode."
      );
      setBusy(false);
    }
  };

  const requestPin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.requestEmailPin(email);
      setPinSent(true);
      setBusy(false);
    } catch (err) {
      setError(
        err instanceof ApiError && err.message === "not_allowed"
          ? "That email isn't on the presenter allowlist."
          : err instanceof ApiError && err.message === "email_unavailable"
            ? "Email delivery is unavailable right now — try the passcode instead."
            : "Could not send the code."
      );
      setBusy(false);
    }
  };

  const verifyPin = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyEmailPin(email, pin);
      setPresenterToken(res.token);
      navigate(next);
    } catch {
      setError("Wrong or expired code.");
      setBusy(false);
    }
  };

  return (
    <main className="container narrow">
      <div className="card">
        <h1>Presenter login</h1>
        <p className="muted small">
          Only authorized presenters can create sessions. The audience never needs to log in.
        </p>

        {passcodeEnabled && (
          <form onSubmit={loginPasscode}>
            <label className="field">
              <span>Passcode</span>
              <input
                type="password"
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoComplete="off"
                autoFocus={!emailEnabled}
              />
            </label>
            <button className="primary big" type="submit" disabled={busy || !passcode}>
              Log in with passcode
            </button>
          </form>
        )}

        {passcodeEnabled && emailEnabled && <div className="divider">or</div>}

        {emailEnabled && !pinSent && (
          <form onSubmit={requestPin}>
            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoFocus={!passcodeEnabled}
              />
            </label>
            <button className="primary big" type="submit" disabled={busy || !email}>
              Email me a login code
            </button>
          </form>
        )}

        {emailEnabled && pinSent && (
          <form onSubmit={verifyPin}>
            <p className="muted small">
              A 6-digit code was sent to <strong>{email}</strong>.
            </p>
            <label className="field">
              <span>Login code</span>
              <input
                className="code-input"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                autoFocus
              />
            </label>
            <button className="primary big" type="submit" disabled={busy || pin.length !== 6}>
              Verify and log in
            </button>
            <button
              className="ghost"
              type="button"
              onClick={() => {
                setPinSent(false);
                setPin("");
                setError(null);
              }}
            >
              Use a different email
            </button>
          </form>
        )}

        {!passcodeEnabled && !emailEnabled && !error && (
          <p className="muted">No login methods are configured on this server.</p>
        )}

        {error && <p className="error">{error}</p>}
      </div>
      <p className="center">
        <Link to="/" className="muted small">
          ← Back
        </Link>
      </p>
    </main>
  );
}

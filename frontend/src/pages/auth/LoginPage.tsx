import { LogIn, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "../../api/axios";
import { demoAccountRequest, type DemoAccount } from "../../api/demoApi";
import AuthLayout from "../../components/auth/AuthLayout";
import Alert from "../../components/ui/Alert";
import Checkbox from "../../components/ui/Checkbox";
import FormField from "../../components/ui/FormField";
import PasswordInput from "../../components/ui/PasswordInput";
import PrimaryButton from "../../components/ui/PrimaryButton";
import TextInput from "../../components/ui/TextInput";
import { useAuth } from "../../context/useAuth";
import { FORCED_PASSWORD_PATH } from "../../routes/forcedPassword";
import { roleDashboard } from "../../routes/roleDashboard";

/**
 * "Remember me" stores the email address only, so returning users do not
 * retype it. It is deliberately NOT part of the session: the JWT still lives
 * under AUTH_TOKEN_KEY and is written, read and cleared solely by
 * AuthProvider. Clearing this value never signs anyone out, and losing the
 * token never loses the prefill.
 */
const REMEMBERED_EMAIL_KEY = "hr_nexus_remembered_email";

function readRememberedEmail(): string {
  try {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
  } catch {
    // Safari private mode throws rather than returning null. A prefill is a
    // convenience, so an unavailable store just means an empty field.
    return "";
  }
}

function writeRememberedEmail(email: string | null) {
  try {
    if (email) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
  } catch {
    // Failing to remember an email must never block a successful sign-in.
  }
}

export default function LoginPage() {
  const { isAuthenticated, isLoading, login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(readRememberedEmail);
  const [rememberMe, setRememberMe] = useState(() => readRememberedEmail() !== "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [demo, setDemo] = useState<DemoAccount | null>(null);

  // Only the public demo answers this; anywhere else the panel never appears.
  useEffect(() => {
    let active = true;
    void demoAccountRequest().then((account) => { if (active) setDemo(account); });
    return () => { active = false; };
  }, []);

  const useDemoAccount = () => {
    if (!demo) return;
    setEmail(demo.email);
    setPassword(demo.password);
    setError("");
    document.getElementById("login-submit")?.focus();
  };

  if (!isLoading && isAuthenticated && user) {
    return (
      <Navigate
        to={user.mustChangePassword ? FORCED_PASSWORD_PATH : roleDashboard(user.role)}
        replace
      />
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Email and password are required.");
      return;
    }

    setIsSubmitting(true);
    try {
      const signedIn = await login(email.trim(), password);
      // Only on success, so a typo is never remembered. This runs before
      // navigate() because navigating unmounts this component.
      writeRememberedEmail(rememberMe ? email.trim() : null);
      // Sign-in succeeds for an account holding a temporary password; it simply
      // does not lead to the dashboard.
      navigate(
        signedIn.mustChangePassword ? FORCED_PASSWORD_PATH : roleDashboard(signedIn.role),
        { replace: true },
      );
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, "Unable to sign in. Please try again."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthLayout tagline>
      <h1 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">Welcome back</h1>
      <p className="mt-2 text-sm text-fg-muted">Sign in with your work account.</p>

      {demo && (
        <section
          aria-labelledby="demo-heading"
          className="mt-6 rounded-xl border border-info/30 bg-info-soft px-4 py-3.5 text-sm text-info-fg"
        >
          <div className="flex items-start gap-3">
            <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <h2 id="demo-heading" className="font-semibold">Exploring the demo?</h2>
              <p className="mt-1 leading-5">
                Meridian Digital is a fictional company. The demo account can open every
                module but can't change anything{demo.resetsDaily ? ", and the data resets every night" : ""}.
              </p>
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-xs">
                <dt className="text-fg-muted">Email</dt>
                <dd className="break-all">{demo.email}</dd>
                <dt className="text-fg-muted">Password</dt>
                <dd className="break-all">{demo.password}</dd>
              </dl>
              <button
                type="button"
                onClick={useDemoAccount}
                className="mt-3 inline-flex min-h-9 items-center rounded-lg border border-info/40 bg-surface px-3 text-sm font-semibold text-fg hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Use demo account
              </button>
            </div>
          </div>
        </section>
      )}

      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        <FormField id="login-email" label="Email address" required>
          <TextInput
            id="login-email"
            className="min-h-11"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.com"
            required
          />
        </FormField>

        <FormField id="login-password" label="Password" required>
          <PasswordInput
            id="login-password"
            className="min-h-11"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </FormField>

        <Checkbox
          id="login-remember"
          label="Remember my email"
          checked={rememberMe}
          onChange={(event) => setRememberMe(event.target.checked)}
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <PrimaryButton
          id="login-submit"
          type="submit"
          fullWidth
          className="min-h-11"
          icon={LogIn}
          isLoading={isSubmitting}
          loadingLabel="Signing in…"
          disabled={isLoading}
        >
          Sign in
        </PrimaryButton>
      </form>

      {/* True of this product: there is no self sign-up or reset flow, so the
          one place to go without an account or a password is HR. */}
      <p className="mt-8 border-t border-line pt-5 text-xs leading-5 text-fg-subtle">
        Accounts and temporary passwords are issued by your HR administrator.
      </p>
    </AuthLayout>
  );
}

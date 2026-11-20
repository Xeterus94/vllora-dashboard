import { useState } from "react";
import { AlertCircle, Eye, EyeOff, FlaskConical, Loader2, Lock, Moon, ShieldCheck, Sun, User } from "lucide-react";
import { DEFAULT_API_BASE } from "../api";
import { MOCK_API_URL } from "../mockWorker";
import { VlloraBadge } from "./VlloraLogo";
import { cn } from "../utils/cn";

export interface LoginValues {
  username: string;
  password: string;
  baseUrl: string;
}

export function LoginScreen({
  onLogin, onDemo, loading, error, dark, onToggleDark,
}: {
  onLogin: (v: LoginValues) => void;
  onDemo: () => void;
  loading: boolean;
  error: string | null;
  dark: boolean;
  onToggleDark?: () => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [touched, setTouched] = useState(false);

  const valid = username.trim() !== "" && password !== "";
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!valid || loading) return;
    onLogin({ username: username.trim(), password, baseUrl: DEFAULT_API_BASE });
  };

  const input =
    "h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-[#9E7835] focus:ring-2 focus:ring-[#C8A256]/25 dark:border-slate-700 dark:bg-slate-800/70 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-[#D6B46C]";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      {/* Theme toggle in corner */}
      {onToggleDark && (
        <button
          type="button"
          onClick={onToggleDark}
          className="fixed right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/90 text-slate-600 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-300 dark:hover:bg-slate-800"
          aria-label="Toggle dark mode"
          title="Toggle dark mode"
        >
          <Sun className={cn("absolute h-4 w-4 transition-all duration-300", dark ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100")} />
          <Moon className={cn("absolute h-4 w-4 transition-all duration-300", dark ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0")} />
        </button>
      )}

      {/* Ambient backdrop in Vllora burgundy & warm gold */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-[#FAF9F6] dark:bg-slate-950" />
        <div className="absolute -top-36 left-1/2 h-96 w-[44rem] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#6B1C2E]/15 via-[#D6B46C]/20 to-[#4F1321]/10 blur-3xl dark:from-[#6B1C2E]/35 dark:via-[#D6B46C]/12 dark:to-[#340A14]/30" />
        <div className="absolute -bottom-40 -left-24 h-80 w-80 rounded-full bg-[#D6B46C]/15 blur-3xl dark:bg-[#6B1C2E]/20" />
        <div className="absolute -bottom-32 -right-24 h-80 w-80 rounded-full bg-[#6B1C2E]/10 blur-3xl dark:bg-[#D6B46C]/10" />
      </div>

      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-6 flex flex-col items-center text-center">
          <VlloraBadge className="h-14 w-14" />
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Vllora Studio</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Master Dashboard · WaaS client portfolio · live CMS
          </p>
        </div>

        <form
          onSubmit={submit}
          className="card space-y-4 p-6 sm:p-7"
          style={{
            boxShadow: dark
              ? "0 24px 60px -24px rgba(107,28,46,0.45)"
              : "0 24px 60px -24px rgba(107,28,46,0.18)",
          }}
        >
          <div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Sign in to Vllora Studio</h2>
              <span className="rounded-full border border-[#D6B46C]/40 bg-[#6B1C2E]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6B1C2E] dark:bg-[#D6B46C]/15 dark:text-[#E8CB8A]">
                Live API
              </span>
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-xs leading-relaxed text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <div className="font-semibold">Connection failed</div>
                <div className="mt-0.5 opacity-90">{error}</div>
                <div className="mt-1.5 opacity-75">
                  Tip: your Worker must allow CORS (<code className="font-mono">Access-Control-Allow-Origin</code>) and accept the <code className="font-mono">Authorization</code> + <code className="font-mono">Content-Type</code> headers.
                </div>
              </div>
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="username">
              Username
            </label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="vllora-admin"
                autoComplete="username"
                className={cn(input, touched && !username.trim() && "border-rose-400 focus:border-rose-400 focus:ring-rose-500/20")}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300" htmlFor="password">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                id="password"
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                autoComplete="current-password"
                className={cn(input, "pr-10", touched && !password && "border-rose-400 focus:border-rose-400 focus:ring-rose-500/20")}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPw ? "Hide password" : "Show password"}
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#6B1C2E] via-[#581524] to-[#3E0D19] text-sm font-semibold text-[#F8EAC8] shadow-lg shadow-[#4F1321]/30 ring-1 ring-[#D6B46C]/35 transition-all hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-[#E8CB8A]" /> Connecting to Worker…
              </>
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 text-[#E8CB8A]" /> Open Master Dashboard
              </>
            )}
          </button>

          <div className="flex items-center gap-3 text-[11px] text-slate-400">
            <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          </div>

          <button
            type="button"
            onClick={() => onLogin({ username: "vllora", password: "demo", baseUrl: MOCK_API_URL })}
            disabled={loading}
            className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#D6B46C]/45 bg-[#FAF5EA] text-xs font-semibold text-[#6B1C2E] transition-colors hover:bg-[#F3E9D2] disabled:opacity-60 dark:border-[#D6B46C]/30 dark:bg-[#6B1C2E]/20 dark:text-[#E8CB8A] dark:hover:bg-[#6B1C2E]/30"
          >
            <FlaskConical className="h-3.5 w-3.5" /> Try the live flow with a simulated Worker
          </button>
          <button
            type="button"
            onClick={onDemo}
            className="h-10 w-full rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Explore with demo data (no login)
          </button>
        </form>

        <p className="mt-4 text-center text-[11px] text-slate-400">
          Vllora Studio Master Dashboard · Client portfolio &amp; CMS
        </p>
      </div>
    </div>
  );
}

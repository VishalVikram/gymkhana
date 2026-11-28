"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, MapPin, Phone, User } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/* Bhoomi Fitness brand: logo orange #FB5D05 + blue #0E70F7 on black (Instagram logo) */
const GYM = {
  name: "Bhoomi Fitness",
  location: "Near Shirke Circle",
  phone: "9900010109",
};

function getSafeCallbackUrl(url: string | null): string {
  const defaultUrl = "/dashboard";
  if (!url) return defaultUrl;

  if (
    url.startsWith("/") &&
    !url.startsWith("//") &&
    !url.toLowerCase().startsWith("/\\") &&
    !url.includes(":")
  ) {
    return url;
  }

  return defaultUrl;
}

function Wordmark() {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/brand/bhoomi-logo.png"
        alt="Bhoomi Fitness logo"
        width={52}
        height={52}
        priority
        className="h-[52px] w-[52px] rounded-full ring-1 ring-white/15"
      />
      <div className="leading-none">
        <div className="text-lg font-extrabold tracking-[0.14em] text-white">
          BHOOMI <span className="text-[#FB5D05]">FITNESS</span>
        </div>
        <div className="mt-1.5 text-[11px] font-medium tracking-wide text-white/55">
          ಭೂಮಿ ಫಿಟ್ನೆಸ್ · BENGALURU
        </div>
      </div>
    </div>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get("callbackUrl"));
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showForgot, setShowForgot] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        contactNumber,
        password,
        remember: rememberMe ? "true" : "false",
        redirect: false,
      });

      if (result?.error) {
        setError("Incorrect email/phone or password.");
      } else if (result?.ok) {
        window.location.href = callbackUrl;
      } else {
        setError("Login failed. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    "h-12 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30 rounded-xl focus-visible:border-[#0E70F7]/70 focus-visible:ring-[#0E70F7]/30";

  return (
    <div className="min-h-screen bg-[#050608] text-white lg:grid lg:grid-cols-[1.15fr_1fr]">
      {/* Photo panel: banner on mobile, full-height on desktop */}
      <section className="relative h-56 overflow-hidden sm:h-72 lg:h-auto lg:min-h-screen">
        <Image
          src="/brand/bhoomi-dumbbells.jpg"
          alt="Inside Bhoomi Fitness: dumbbell racks and training floor"
          fill
          priority
          sizes="(min-width: 1024px) 55vw, 100vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050608] via-[#050608]/55 to-[#050608]/20 lg:bg-gradient-to-r lg:from-[#050608]/30 lg:via-[#050608]/40 lg:to-[#050608]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#050608]/90 via-transparent to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between p-6 sm:p-10">
          <Wordmark />
          <div className="hidden max-w-md lg:block">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-[#FB5D05]">
              Staff portal
            </p>
            <h2 className="text-4xl font-extrabold leading-tight tracking-tight">
              Strength isn&apos;t given.{" "}
              <span className="bg-gradient-to-r from-[#FB5D05] to-[#0E70F7] bg-clip-text text-transparent">
                It&apos;s earned.
              </span>
            </h2>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/65">
              <span className="inline-flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#FB5D05]" /> {GYM.location}
              </span>
              <a href={`tel:${GYM.phone}`} className="inline-flex items-center gap-2 hover:text-white">
                <Phone className="h-4 w-4 text-[#4C94FF]" /> {GYM.phone}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex flex-col px-6 pb-8 sm:px-10 lg:min-h-screen lg:justify-center lg:py-12">
        <div className="mx-auto w-full max-w-sm flex-1 lg:flex-none">
          <div className="mb-8 -mt-6 lg:mt-0">
            <h1 className="text-3xl font-bold tracking-tight">Staff login</h1>
            <p className="mt-2 text-sm text-white/55">
              Sign in to manage members, payments and attendance at {GYM.name}.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="contactNumber" className="text-sm text-white/70">
                Email or phone
              </Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  id="contactNumber"
                  type="text"
                  name="contactNumber"
                  autoComplete="username"
                  value={contactNumber}
                  onChange={(e) => setContactNumber(e.target.value)}
                  required
                  aria-required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`${inputClass} pl-11`}
                  placeholder="Email or phone number"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm text-white/70">
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowForgot((v) => !v)}
                  className="rounded text-xs text-[#4C94FF] transition-colors hover:text-[#8DB9FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E70F7]/60"
                  aria-expanded={showForgot}
                  aria-controls="forgot-help"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  aria-required
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "login-error" : undefined}
                  className={`${inputClass} pl-11 pr-11`}
                  placeholder="Your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 rounded-md text-white/40 transition-colors hover:text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E70F7]/60"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {showForgot && (
                <p
                  id="forgot-help"
                  className="rounded-lg border border-[#0E70F7]/30 bg-[#0E70F7]/10 px-3 py-2 text-xs text-[#B7D2FF]"
                >
                  Ask the gym admin to reset your password from Settings → Team &amp; access.
                </p>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(v === true)}
                className="border-white/30 bg-white/5 data-[state=checked]:border-[#FB5D05] data-[state=checked]:bg-[#FB5D05] data-[state=checked]:text-black"
              />
              <Label htmlFor="remember" className="cursor-pointer text-sm text-white/60">
                Keep me signed in on this device
              </Label>
            </div>

            {error && (
              <div
                id="login-error"
                role="alert"
                className="rounded-xl border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-300"
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="flex h-12 w-full items-center justify-center rounded-xl bg-[#FB5D05] font-semibold text-[#050608] shadow-lg shadow-[#FB5D05]/25 transition-colors hover:bg-[#FF7426] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0E70F7] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050608] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in…
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/55">
            New here?{" "}
            <Link
              href={`/signup${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`}
              className="font-semibold text-[#4C94FF] transition-colors hover:text-[#8DB9FF]"
            >
              Create an account
            </Link>
          </p>

          {/* Gym contact (mobile; desktop shows it on the photo) */}
          <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/50 lg:hidden">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-[#FB5D05]" /> {GYM.location}
            </span>
            <a href={`tel:${GYM.phone}`} className="inline-flex items-center gap-1.5 hover:text-white">
              <Phone className="h-3.5 w-3.5 text-[#4C94FF]" /> {GYM.phone}
            </a>
          </div>
        </div>

        <p className="mx-auto mt-10 w-full max-w-sm text-xs text-white/30 lg:mt-16">
          © {new Date().getFullYear()} {GYM.name}
        </p>
      </section>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#050608]">
          <Loader2 className="h-6 w-6 animate-spin text-[#FB5D05]" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

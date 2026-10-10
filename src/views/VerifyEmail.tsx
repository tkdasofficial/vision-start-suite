import { useState } from "react";
import { useNavigate } from "@/lib/router-compat";
import { supabase } from "@/lib/cloud/client";
import { Mail, ArrowLeft, ShieldCheck, Lock, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import logo from "@/assets/logo.svg";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

const VerifyEmail = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const email = params.get("email") ?? "";
  const [code, setCode] = useState("");
  const isReset = params.get("mode") === "reset";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const mismatch = isReset && confirm.length > 0 && password !== confirm;
  const canSubmit = code.length === 8 && (!isReset || (password.length >= 8 && password === confirm));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async () => {
    if (!canSubmit || !email) return;
    setLoading(true);
    try {
      if (isReset) {
        const { error } = await supabase.auth.resetPasswordWithCode(email, code, password);
        if (error) throw error;
        toast({ title: "Password updated", description: "You're signed in." });
        navigate("/app/new");
        return;
      }
      const { error } = await supabase.auth.verifyEmailCode(email, code);
      if (error) throw error;
      toast({ title: "Email verified", description: "Welcome to Vision!" });
      navigate("/getting-started");
    } catch (e: any) {
      toast({ title: "Invalid code", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) return;
    setResending(true);
    try {
      const { error } = isReset
        ? await supabase.auth.resetPasswordForEmail(email)
        : await supabase.auth.resendVerificationCode(email);
      if (error) throw error;
      toast({ title: "Code sent", description: "Check your inbox for a new code." });
    } catch (e: any) {
      toast({ title: "Couldn't resend", description: e.message, variant: "destructive" });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col px-6 py-10 sm:py-14">
      <div className="w-full max-w-sm mx-auto flex-1 flex flex-col justify-center gap-8">
        <div className="space-y-2">
          <img src={logo} alt="Vision" className="w-12 h-12 rounded-2xl" />
          <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-foreground pt-4">{isReset ? "Reset your password" : "Verify your email"}</h1>
          <p className="text-sm text-muted-foreground">
            We sent an 8-digit code to <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex justify-center" data-testid="otp-input">
            <InputOTP maxLength={8} value={code} onChange={setCode}>
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {isReset && (
            <div className="space-y-3">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={show ? "text" : "password"}
                  placeholder="New password (min 8 characters)"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-11 pr-11 py-3 rounded-full border border-border bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 transition-colors"
                />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type={show ? "text" : "password"}
                  placeholder="Confirm new password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 rounded-full border border-border bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground/30 transition-colors"
                />
              </div>
              {mismatch && <p className="text-xs text-destructive">Passwords don't match.</p>}
            </div>
          )}

          <button
            onClick={handleVerify}
            disabled={loading || !canSubmit}
            className="w-full py-3 rounded-full bg-foreground text-background text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            <ShieldCheck className="h-4 w-4" />
            {loading ? (isReset ? "Updating…" : "Verifying…") : isReset ? "Reset password & sign in" : "Verify email"}
          </button>

          <div className="flex items-center justify-between text-sm">
            <button
              onClick={() => navigate("/login")}
              className="text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
            </button>
            <button
              onClick={handleResend}
              disabled={resending}
              className="text-foreground font-medium hover:underline disabled:opacity-50 flex items-center gap-1"
            >
              <Mail className="h-3.5 w-3.5" /> {resending ? "Sending…" : "Resend code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

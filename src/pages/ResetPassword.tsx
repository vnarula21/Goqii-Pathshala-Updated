import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

// Landing page for the emailed reset link:  /reset-password?token_hash=...&type=recovery
// The one-time token is only exchanged when the user submits a new password.
export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const tokenHash = params.get("token_hash");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Fallback for links created by Supabase's own reset email (session in URL hash).
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    if (tokenHash) return;
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [tokenHash]);

  const linkUsable = !!tokenHash || hasSession === true;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsSubmitting(true);

    if (tokenHash) {
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "recovery",
      });
      if (verifyError) {
        toast.error("This reset link is invalid or has expired. Please request a new one.");
        setIsSubmitting(false);
        return;
      }
    }

    const { data: userData, error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      toast.error("Failed to reset password: " + error.message);
      setIsSubmitting(false);
      return;
    }

    // They just chose this password themselves, so no forced change on next login.
    if (userData.user) {
      await supabase
        .from("profiles")
        .update({ must_change_password: false })
        .eq("id", userData.user.id);
    }

    await supabase.auth.signOut();
    toast.success("Password reset successfully. Please sign in with your new password.");
    setIsSubmitting(false);
    navigate("/auth", { replace: true });
  };

  if (hasSession === false && !tokenHash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Reset link not valid</CardTitle>
            <CardDescription>
              This password reset link is missing, already used, or has expired.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild className="w-full">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Reset your password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting || !linkUsable}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Reset Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useChangeDoctorPassword } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Stethoscope, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function SetPasswordPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: user, isLoading } = useGetMe({ query: { retry: false } });

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const changePassword = useChangeDoctorPassword();

  useEffect(() => {
    if (!isLoading && !user) {
      setLocation("/login");
    } else if (!isLoading && user && !user.mustChangePassword) {
      setLocation("/");
    }
  }, [user, isLoading, setLocation]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !user.mustChangePassword) {
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Current password is required.");
      return;
    }
    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    changePassword.mutate(
      { data: { currentPassword, newPassword, confirmPassword } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({
            title: "Password changed",
            description: "Your new password has been saved. Welcome!",
          });
          setLocation("/");
        },
        onError: (err: Error) => {
          setError(err.message ?? "Failed to set password. Please try again.");
        },
      }
    );
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50 p-4">
      <div className="absolute inset-0 bg-grid-slate-200/[0.04] bg-[bottom_1px_center]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-lg shadow-primary/10 text-primary mb-4 border border-primary/10">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="font-display text-3xl font-bold text-slate-900 tracking-tight">KetoKid Care</h1>
          <p className="text-slate-500 mt-2">Pediatric Ketogenic Therapy Portal</p>
        </div>

        <Card className="border-0 shadow-xl shadow-black/5 bg-white/90 backdrop-blur-sm rounded-2xl overflow-hidden">
          <div className="h-2 w-full bg-gradient-to-r from-primary to-secondary" />
          <CardHeader className="space-y-1 pb-6 px-8 pt-8">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
                <Lock className="h-4 w-4 text-amber-600" />
              </div>
              <CardTitle className="text-2xl font-bold">Change Your Password</CardTitle>
            </div>
            <CardDescription className="text-base">
              Welcome, {user.name}! For security, you must set a new password before accessing the system.
            </CardDescription>
          </CardHeader>
          <CardContent className="px-8 pb-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Current (Temporary) Password</Label>
                <Input
                  type="password"
                  placeholder="Your temporary password"
                  value={currentPassword}
                  onChange={(e) => { setCurrentPassword(e.target.value); setError(null); }}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">New Password</Label>
                <Input
                  type="password"
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); setError(null); }}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-700 font-semibold">Confirm New Password</Label>
                <Input
                  type="password"
                  placeholder="Repeat your new password"
                  value={confirmPassword}
                  onChange={(e) => { setConfirmPassword(e.target.value); setError(null); }}
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                  required
                />
              </div>

              {error && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all active:scale-[0.98]"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin" /> Saving...
                  </span>
                ) : "Set Password & Continue"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

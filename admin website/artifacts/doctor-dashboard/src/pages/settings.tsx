import { useState, useEffect } from "react";
import { useGetMe, useUpdateDoctorProfile, useChangeDoctorPassword, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useIsModerator } from "@/hooks/useRole";

function SectionCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-800">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{description}</p>
      </div>
      <div className="px-6 py-6">{children}</div>
    </div>
  );
}

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all placeholder:text-slate-400 ${props.className ?? ""}`}
    />
  );
}

export default function SettingsPage() {
  const { data: user } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isModerator = useIsModerator();

  const updateProfile = useUpdateDoctorProfile();
  const changePassword = useChangeDoctorPassword();

  const [profile, setProfile] = useState({
    name: "",
    email: "",
    username: "",
    designation: "",
  });

  useEffect(() => {
    if (user) {
      setProfile({
        name: user.name ?? "",
        email: user.email ?? "",
        username: user.username ?? "",
        designation: user.designation ?? "",
      });
    }
  }, [user?.id, user?.name, user?.email, user?.username, user?.designation]);

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  function handleProfileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setProfile((p) => ({ ...p, [e.target.name]: e.target.value }));
    setProfileError(null);
  }

  function handlePasswordChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPasswords((p) => ({ ...p, [e.target.name]: e.target.value }));
    setPasswordError(null);
  }

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile.name.trim() || !profile.email.trim() || !profile.username.trim()) {
      setProfileError("Name, email, and username are required.");
      return;
    }
    updateProfile.mutate(
      { data: { name: profile.name.trim(), email: profile.email.trim(), username: profile.username.trim(), designation: profile.designation.trim() || undefined } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          toast({ title: "Profile updated", description: "Your profile information has been saved." });
        },
        onError: (err: unknown) => {
          const apiErr = err as { data?: { message?: string }; message?: string };
          const msg = apiErr?.data?.message ?? apiErr?.message ?? "Failed to update profile.";
          setProfileError(msg);
        },
      }
    );
  }

  function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!passwords.currentPassword || !passwords.newPassword || !passwords.confirmPassword) {
      setPasswordError("All password fields are required.");
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }
    if (passwords.newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters.");
      return;
    }
    changePassword.mutate(
      { data: { currentPassword: passwords.currentPassword, newPassword: passwords.newPassword, confirmPassword: passwords.confirmPassword } },
      {
        onSuccess: () => {
          setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });
          toast({ title: "Password changed", description: "Your password has been updated successfully." });
        },
        onError: (err: unknown) => {
          const apiErr = err as { data?: { message?: string }; message?: string };
          const msg = apiErr?.data?.message ?? apiErr?.message ?? "Failed to change password.";
          setPasswordError(msg);
        },
      }
    );
  }

  const initials = user?.name
    ? user.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()
    : "DR";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your account information and security.</p>
      </div>

      {isModerator && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <span className="text-amber-500 mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Read-only account</p>
            <p className="text-xs text-amber-700 mt-0.5">Moderator accounts cannot update profile information. Contact an admin to make changes to your name, email, or username. You can still change your own password below.</p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-black text-xl shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-lg font-bold text-slate-800">{user?.name ?? "—"}</p>
          <p className="text-sm text-slate-500">{user?.email ?? "—"}</p>
          <p className="text-xs text-blue-600 font-semibold mt-0.5">{user?.designation ?? "No designation set"}</p>
        </div>
      </div>

      <SectionCard title="Profile Information" description={isModerator ? "Profile information (read-only for moderators)." : "Update your name, email, username, and designation."}>
        <form onSubmit={handleProfileSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="Full Name">
              <Input
                name="name"
                value={profile.name}
                onChange={handleProfileChange}
                placeholder="e.g. Jane Smith"
                required
                disabled={isModerator}
              />
            </FieldGroup>
            <FieldGroup label="Username">
              <Input
                name="username"
                value={profile.username}
                onChange={handleProfileChange}
                placeholder="e.g. jsmith"
                required
                disabled={isModerator}
              />
            </FieldGroup>
          </div>
          <FieldGroup label="Email Address">
            <Input
              name="email"
              type="email"
              value={profile.email}
              onChange={handleProfileChange}
              placeholder="e.g. jane@clinic.com"
              required
              disabled={isModerator}
            />
          </FieldGroup>
          <FieldGroup label="Designation (optional)">
            <Input
              name="designation"
              value={profile.designation}
              onChange={handleProfileChange}
              placeholder="e.g. Pediatric Neurologist"
              disabled={isModerator}
            />
          </FieldGroup>

          {profileError && (
            <p className="text-sm text-red-600 font-medium">{profileError}</p>
          )}

          {!isModerator && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={updateProfile.isPending}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all"
              >
                {updateProfile.isPending ? "Saving…" : "Save Profile"}
              </button>
            </div>
          )}
        </form>
      </SectionCard>

      <SectionCard title="Change Password" description="Update your login password. You'll need to enter your current password to confirm.">
        <form onSubmit={handlePasswordSubmit} className="space-y-4">
          <FieldGroup label="Current Password">
            <Input
              name="currentPassword"
              type="password"
              value={passwords.currentPassword}
              onChange={handlePasswordChange}
              placeholder="Enter your current password"
              autoComplete="current-password"
              required
            />
          </FieldGroup>
          <div className="grid grid-cols-2 gap-4">
            <FieldGroup label="New Password">
              <Input
                name="newPassword"
                type="password"
                value={passwords.newPassword}
                onChange={handlePasswordChange}
                placeholder="Min. 6 characters"
                autoComplete="new-password"
                required
              />
            </FieldGroup>
            <FieldGroup label="Confirm New Password">
              <Input
                name="confirmPassword"
                type="password"
                value={passwords.confirmPassword}
                onChange={handlePasswordChange}
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
              />
            </FieldGroup>
          </div>

          {passwordError && (
            <p className="text-sm text-red-600 font-medium">{passwordError}</p>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={changePassword.isPending}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-all"
            >
              {changePassword.isPending ? "Changing…" : "Change Password"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}

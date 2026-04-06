import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const { login } = useAuth();
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter your access token");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await login(token.trim());
    } catch (err: any) {
      setError(err.message || "Invalid token. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center px-8">
      <div className="w-full max-w-sm flex flex-col items-center">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center mb-6 shadow-lg shadow-green-200/40">
          <span className="material-symbols-outlined text-white text-4xl">
            child_care
          </span>
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-on-background mb-2">
          KetoKid Care
        </h1>
        <p className="text-on-surface-variant font-medium text-center mb-10">
          Enter your hospital-provided token to access your child's nutrition plan
        </p>

        <form onSubmit={handleSubmit} className="w-full space-y-6">
          <div>
            <label className="block text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Access Token
            </label>
            <input
              type="text"
              value={token}
              onChange={(e) => {
                setToken(e.target.value);
                setError("");
              }}
              placeholder="Enter your token"
              className="w-full bg-surface-container-high rounded-[1.5rem] px-6 py-4 text-on-surface font-medium outline-none border-none focus:bg-surface-container-lowest focus:ring-2 focus:ring-primary/20 transition-all duration-200 placeholder:text-outline"
              autoFocus
              autoComplete="off"
            />
          </div>

          {error && (
            <div className="bg-error-container rounded-2xl px-4 py-3 flex items-center gap-3">
              <span className="material-symbols-outlined text-on-error-container text-xl">
                error
              </span>
              <p className="text-sm font-medium text-on-error-container">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary text-on-primary py-4 rounded-full font-bold text-lg hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-green-900/20"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </span>
            ) : (
              "Continue"
            )}
          </button>
        </form>

        <button className="mt-8 text-primary font-semibold text-sm hover:underline">
          Need help? Contact your hospital
        </button>
      </div>
    </div>
  );
}

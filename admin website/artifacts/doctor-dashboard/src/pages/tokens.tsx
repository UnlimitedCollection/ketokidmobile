import { useState, useEffect, useMemo, useCallback } from "react";
import { usePrint } from "@/hooks/usePrint";
import { PrintLayout } from "@/components/print-layout";
import { PrintFilterDialog, type PrintFilterResult } from "@/components/print-filter-dialog";
import { useListTokens, useCreateToken, useResetToken, useRevokeToken } from "@workspace/api-client-react";
import { useGetKids } from "@workspace/api-client-react";
import type { ParentToken } from "@workspace/api-client-react";
import { Loader2, Key, RefreshCw, Trash2, Plus, Copy, CheckCheck, Eye, EyeOff } from "lucide-react";
import { PrintButton } from "@/components/print-button";
import { useQueryClient } from "@tanstack/react-query";
import { getListTokensQueryKey } from "@workspace/api-client-react";
import { useCanWrite } from "@/hooks/useRole";

const BLUE  = "#004ac6";
const GREEN = "#0a7c42";
const RED   = "#ae0010";
const AMBER = "#855300";
const GRAY  = "#64748b";

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { bg: string; text: string; label: string }> = {
    active:  { bg: `${GREEN}18`, text: GREEN,  label: "Active"  },
    used:    { bg: `${BLUE}18`,  text: BLUE,   label: "Used"    },
    expired: { bg: `${AMBER}18`, text: AMBER,  label: "Expired" },
    revoked: { bg: `${RED}18`,   text: RED,    label: "Revoked" },
  };
  const c = cfg[status] ?? cfg.expired;
  return (
    <span
      className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide"
      style={{ background: c.bg, color: c.text }}
    >
      {c.label}
    </span>
  );
}

const SHORT_TOKEN_RE = /^[A-Z]{3}-\d{4}$/;

function maskToken(token: string): string {
  if (SHORT_TOKEN_RE.test(token)) {
    return "•••-••••";
  }
  return token.slice(0, 4) + "••••••••••••••••••••••••" + token.slice(-4);
}

function TokenCell({ token, status }: { token: string; status: string }) {
  const isShort = SHORT_TOKEN_RE.test(token);
  const [visible, setVisible] = useState(isShort);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isShort) setVisible(true);
  }, [token, isShort]);

  const handleCopy = () => {
    navigator.clipboard.writeText(token).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const display = visible ? token : maskToken(token);

  const isInactive = status === "expired" || status === "revoked";

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className="font-mono font-bold tracking-widest truncate"
        style={{
          color: isInactive ? GRAY : "#1e293b",
          fontSize: isShort ? "1rem" : "0.75rem",
        }}
      >
        {display}
      </span>
      <button
        onClick={() => setVisible(!visible)}
        className="no-print text-slate-400 hover:text-slate-600 shrink-0"
        title={visible ? "Hide token" : "Show token"}
      >
        {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
      </button>
      <button
        onClick={handleCopy}
        className="no-print text-slate-400 hover:text-blue-600 shrink-0"
        title="Copy token"
      >
        {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function GenerateDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { data: kids, isLoading: kidsLoading } = useGetKids();
  const createToken = useCreateToken();
  const [selectedKidId, setSelectedKidId] = useState<number | "">("");
  const [expiresInDays, setExpiresInDays] = useState(90);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedKidId) {
      setError("Please select a child.");
      return;
    }
    setError("");
    createToken.mutate(
      { data: { kidId: Number(selectedKidId), expiresInDays } },
      {
        onSuccess: () => onCreated(),
        onError: (err: unknown) => {
          const msg = (err as { data?: { message?: string } })?.data?.message ?? "Failed to generate token";
          setError(msg);
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-lg font-bold text-slate-900 mb-1">Generate Parent Token</h2>
        <p className="text-sm text-slate-500 mb-5">
          Creates a secure login token for the parent of the selected child.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Child</label>
            {kidsLoading ? (
              <div className="h-10 rounded-lg bg-slate-100 animate-pulse" />
            ) : (
              <select
                value={selectedKidId}
                onChange={(e) => setSelectedKidId(e.target.value ? Number(e.target.value) : "")}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
              >
                <option value="">Select a child…</option>
                {kids?.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1.5">Expires in (days)</label>
            <input
              type="number"
              min={1}
              max={365}
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
          </div>
          {error && <p className="text-sm text-red-600 font-medium">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createToken.isPending}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {createToken.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Key className="h-4 w-4" />
              )}
              Generate
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const TOKENS_PRINT_SECTIONS = [
  { id: "summary",  label: "Token Summary Stats", defaultChecked: true },
  { id: "token-list", label: "Token List Table",  defaultChecked: true },
];

export default function TokensPage() {
  const queryClient = useQueryClient();
  const { data: tokens, isLoading } = useListTokens();
  const resetToken = useResetToken();
  const revokeToken = useRevokeToken();
  const { data: kids } = useGetKids();

  const canWrite = useCanWrite();
  const [showDialog, setShowDialog] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState<number | null>(null);
  const { printRef, handlePrint } = usePrint("Parent Access Tokens Report");
  const [printFilterOpen, setPrintFilterOpen] = useState(false);
  const [printSelectedSections, setPrintSelectedSections] = useState<Set<string>>(new Set(["summary", "token-list"]));
  const [printSelectedKidIds, setPrintSelectedKidIds] = useState<Set<string> | null>(null);
  const [printDateRange, setPrintDateRange] = useState<{ start: string; end: string } | undefined>();

  const kidEntities = useMemo(
    () => (kids ?? []).map((k) => ({ id: String(k.id), label: k.name })),
    [kids]
  );

  const handlePrintFilterConfirm = useCallback((result: PrintFilterResult) => {
    setPrintSelectedSections(new Set(result.selectedIds));
    setPrintSelectedKidIds(new Set(result.selectedEntityIds));
    setPrintDateRange(result.dateRange);
    handlePrint();
  }, [handlePrint]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTokensQueryKey() });

  const handleReset = (tokenId: number) => {
    resetToken.mutate({ tokenId }, { onSuccess: invalidate });
  };

  const handleRevoke = (tokenId: number) => {
    revokeToken.mutate({ tokenId }, {
      onSuccess: () => {
        setConfirmRevoke(null);
        invalidate();
      },
    });
  };

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric", month: "short", day: "numeric",
    });
  }

  const sorted = [...(tokens ?? [])].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const printedTokens = useMemo(() => {
    let result = sorted;
    if (printSelectedKidIds !== null) {
      result = result.filter(t => printSelectedKidIds.has(String(t.kidId)));
    }
    if (printDateRange) {
      result = result.filter(t => {
        const created = t.createdAt.slice(0, 10);
        if (printDateRange.start && created < printDateRange.start) return false;
        if (printDateRange.end && created > printDateRange.end) return false;
        return true;
      });
    }
    return result;
  }, [sorted, printSelectedKidIds, printDateRange]);

  return (
    <PrintLayout innerRef={printRef} className="space-y-6 pb-10">
      <PrintFilterDialog
        open={printFilterOpen}
        onOpenChange={setPrintFilterOpen}
        title="Print Token Report"
        description="Choose which sections and patients to include."
        options={TOKENS_PRINT_SECTIONS}
        entities={kidEntities}
        entityLabel="Patients to Filter By"
        showDateRange
        onConfirm={handlePrintFilterConfirm}
      />

      <div className="no-print flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900">Parent Access Tokens</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Generate secure login tokens for parents to access their child's meal records
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintButton onPrint={() => setPrintFilterOpen(true)} />
          {canWrite && (
            <button
              onClick={() => setShowDialog(true)}
              className="no-print flex items-center gap-2 bg-[#004ac6] text-white px-5 py-2.5 rounded-full text-sm font-semibold hover:bg-blue-700 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4" />
              Generate Token
            </button>
          )}
        </div>
      </div>

      <div className="no-print grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Tokens",   value: sorted.length,                                                        color: BLUE  },
          { label: "Active",         value: sorted.filter(t => t.status === "active").length,                     color: GREEN },
          { label: "Expired / Used", value: sorted.filter(t => t.status !== "active" && t.status !== "revoked").length, color: AMBER },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4">
            <div
              className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: `${stat.color}18` }}
            >
              <Key className="h-5 w-5" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-black text-slate-900">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="no-print bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-800">All Tokens</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
            <Key className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">No tokens generated yet</p>
            <p className="text-xs">Click "Generate Token" to create one for a parent</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wider">
                  <th className="px-6 py-3 text-left font-semibold">Child</th>
                  <th className="px-4 py-3 text-left font-semibold">Token</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-left font-semibold">Created</th>
                  <th className="px-4 py-3 text-left font-semibold">Expires</th>
                  <th className="no-print px-4 py-3 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t: ParentToken) => (
                  <tr key={t.id} className="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                          style={{ background: BLUE }}
                        >
                          {t.kidName.charAt(0)}
                        </div>
                        <span className="font-semibold text-slate-800">{t.kidName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 max-w-[220px]">
                      <div className="no-print">
                        <TokenCell token={t.token} status={t.status} />
                      </div>
                      <span className="hidden print-only font-mono text-xs text-slate-800 break-all">{t.token}</span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(t.createdAt)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(t.expiresAt)}</td>
                    <td className="no-print px-4 py-3 text-right">
                      {canWrite && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleReset(t.id)}
                            disabled={resetToken.isPending}
                            title="Reset token"
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setConfirmRevoke(t.id)}
                            title="Revoke token"
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showDialog && (
        <GenerateDialog
          onClose={() => setShowDialog(false)}
          onCreated={() => {
            setShowDialog(false);
            invalidate();
          }}
        />
      )}

      {/* Print-only section */}
      <div className="hidden print-section space-y-4">
        {printSelectedSections.has("summary") && (
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-2">Token Summary</h2>
            <table className="w-full text-xs border-collapse max-w-xs">
              <tbody>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Total Tokens</td>
                  <td className="py-1 px-2 text-slate-800">{printedTokens.length}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Active</td>
                  <td className="py-1 px-2 text-slate-800">{printedTokens.filter(t => t.status === "active").length}</td>
                </tr>
                <tr className="border-b border-slate-100">
                  <td className="py-1 px-2 font-semibold text-slate-600">Expired / Used</td>
                  <td className="py-1 px-2 text-slate-800">{printedTokens.filter(t => t.status !== "active" && t.status !== "revoked").length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        {printSelectedSections.has("token-list") && printedTokens.length > 0 && (
          <div>
            <h2 className="text-base font-bold text-slate-800 mb-2">Token List ({printedTokens.length})</h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Child</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Token</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Status</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Created</th>
                  <th className="text-left py-1.5 px-2 font-semibold text-slate-600">Expires</th>
                </tr>
              </thead>
              <tbody>
                {printedTokens.map((t: ParentToken) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-1.5 px-2 text-slate-800 font-medium">{t.kidName}</td>
                    <td className="py-1.5 px-2 font-mono text-slate-600 break-all">{t.token}</td>
                    <td className="py-1.5 px-2 text-slate-600 capitalize">{t.status}</td>
                    <td className="py-1.5 px-2 text-slate-600">{formatDate(t.createdAt)}</td>
                    <td className="py-1.5 px-2 text-slate-600">{formatDate(t.expiresAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmRevoke !== null && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="h-6 w-6 text-red-600" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">Revoke Token?</h3>
            <p className="text-sm text-slate-500 mb-6">
              The parent will lose access immediately. You can generate a new token at any time.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRevoke(null)}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRevoke(confirmRevoke)}
                disabled={revokeToken.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 disabled:opacity-50"
              >
                {revokeToken.isPending ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : "Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </PrintLayout>
  );
}

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity, AlertTriangle, CheckCircle2, Loader2, Wrench, Brain,
  ShieldAlert, Clock, Users, MessageCircle, Zap, RefreshCw
} from "lucide-react";

interface HealthIssue {
  type: string;
  severity: "high" | "medium" | "low";
  count: number;
  message: string;
  users?: string[];
}

interface ScanResult {
  issues: HealthIssue[];
  stats: { totalProfiles: number; totalMessages: number; totalConvos: number };
  aiAnalysis: string;
  scannedAt: string;
}

export function AdminHealthPanel() {
  const [scanning, setScanning] = useState(false);
  const [fixing, setFixing] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [fixResult, setFixResult] = useState<string[] | null>(null);

  const runScan = async () => {
    setScanning(true);
    setFixResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sem sessão");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/site-health`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "scan" }),
        }
      );
      if (!resp.ok) throw new Error("Erro no scan");
      const data = await resp.json();
      setResult(data);
      if (data.issues.length === 0) toast.success("Nenhum problema encontrado!");
      else toast.warning(`${data.issues.length} problema(s) encontrado(s)`);
    } catch (e: any) {
      toast.error(e.message || "Erro ao escanear");
    }
    setScanning(false);
  };

  const runAutoFix = async () => {
    setFixing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sem sessão");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/site-health`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ action: "autofix" }),
        }
      );
      if (!resp.ok) throw new Error("Erro no autofix");
      const data = await resp.json();
      setFixResult(data.fixed);
      toast.success("Auto-fix concluído!");
      // Re-scan after fix
      setTimeout(() => runScan(), 1000);
    } catch (e: any) {
      toast.error(e.message || "Erro no auto-fix");
    }
    setFixing(false);
  };

  const severityColor = (s: string) => {
    if (s === "high") return "text-red-400 bg-red-500/10 border-red-500/30";
    if (s === "medium") return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    return "text-blue-400 bg-blue-500/10 border-blue-500/30";
  };

  const severityIcon = (s: string) => {
    if (s === "high") return <ShieldAlert className="w-4 h-4" />;
    if (s === "medium") return <AlertTriangle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold text-foreground">IA Health Monitor</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">AUTO-FIX</span>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={runScan}
            disabled={scanning}
            className="text-xs gap-1"
          >
            {scanning ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Escanear
          </Button>
          <Button
            size="sm"
            onClick={runAutoFix}
            disabled={fixing || !result || result.issues.length === 0}
            className="text-xs gap-1 bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500"
          >
            {fixing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wrench className="w-3 h-3" />}
            Auto-Fix Tudo
          </Button>
        </div>
      </div>

      {/* Stats */}
      {result && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="w-3.5 h-3.5" /> Perfis
            </div>
            <p className="text-xl font-bold mt-1">{result.stats.totalProfiles || 0}</p>
          </Card>
          <Card className="p-3 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MessageCircle className="w-3.5 h-3.5" /> Mensagens
            </div>
            <p className="text-xl font-bold mt-1">{result.stats.totalMessages || 0}</p>
          </Card>
          <Card className="p-3 bg-card/50 border-border/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Zap className="w-3.5 h-3.5" /> Conversas
            </div>
            <p className="text-xl font-bold mt-1">{result.stats.totalConvos || 0}</p>
          </Card>
        </div>
      )}

      {/* AI Analysis */}
      {result?.aiAnalysis && (
        <Card className="p-4 bg-gradient-to-br from-purple-500/5 to-cyan-500/5 border-purple-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-semibold text-purple-400">Análise IA</span>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed">{result.aiAnalysis}</p>
        </Card>
      )}

      {/* Issues */}
      {result && result.issues.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Problemas ({result.issues.length})
          </h3>
          {result.issues.map((issue, i) => (
            <Card key={i} className={`p-3 border ${severityColor(issue.severity)}`}>
              <div className="flex items-start gap-2">
                {severityIcon(issue.severity)}
                <div className="flex-1">
                  <p className="text-sm font-medium">{issue.message}</p>
                  {issue.users && issue.users.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Usuários: {issue.users.slice(0, 5).join(", ")}
                      {issue.users.length > 5 && ` +${issue.users.length - 5}`}
                    </p>
                  )}
                </div>
                <span className="text-xs font-mono px-1.5 py-0.5 rounded bg-white/5">{issue.count}</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Fix Results */}
      {fixResult && (
        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-semibold text-emerald-400">Correções Aplicadas</span>
          </div>
          <ul className="space-y-1">
            {fixResult.map((fix, i) => (
              <li key={i} className="text-sm text-foreground/80 flex items-center gap-2">
                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                {fix}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* Empty state */}
      {result && result.issues.length === 0 && !fixResult && (
        <Card className="p-8 text-center bg-emerald-500/5 border-emerald-500/20">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-emerald-400">Site 100% saudável!</p>
          <p className="text-xs text-muted-foreground mt-1">Nenhum problema encontrado.</p>
        </Card>
      )}

      {/* No scan yet */}
      {!result && !scanning && (
        <Card className="p-8 text-center bg-card/50 border-border/50">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-sm text-muted-foreground">Clique em "Escanear" para verificar a saúde do site</p>
          <p className="text-xs text-muted-foreground/60 mt-1">A IA vai analisar e sugerir correções automáticas</p>
        </Card>
      )}

      {scanning && (
        <Card className="p-8 text-center bg-card/50 border-border/50">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Escaneando site com IA...</p>
        </Card>
      )}

      {result && (
        <p className="text-[10px] text-muted-foreground/50 text-center">
          Último scan: {new Date(result.scannedAt).toLocaleString("pt-BR")}
        </p>
      )}
    </div>
  );
}

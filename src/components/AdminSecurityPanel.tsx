import { useState } from "react";
import { ShieldAlert, ShieldCheck, AlertTriangle, Eye, EyeOff, CheckCircle2 } from "lucide-react";

export function AdminSecurityPanel() {
  const [showIgnored, setShowIgnored] = useState(false);
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Painel de Segurança</h2>
            <p className="text-xs text-muted-foreground">Monitoramento de vulnerabilidades e proteções</p>
          </div>
        </div>
        <button
          onClick={() => setShowIgnored(!showIgnored)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border/50 text-muted-foreground hover:text-foreground transition-all"
        >
          {showIgnored ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
          {showIgnored ? "Ocultar ignorados" : "Mostrar ignorados"}
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <StatusCard icon={ShieldCheck} label="RLS Ativo" value="Todas as tabelas" color="text-emerald-400" bg="bg-emerald-500/10 border-emerald-500/20" />
        <StatusCard icon={ShieldCheck} label="Auth" value="Email + Fingerprint" color="text-blue-400" bg="bg-blue-500/10 border-blue-500/20" />
        <StatusCard icon={ShieldCheck} label="Perfil Protegido" value="Campos bloqueados" color="text-purple-400" bg="bg-purple-500/10 border-purple-500/20" />
        <StatusCard icon={ShieldCheck} label="Roles" value="Admin-only CRUD" color="text-cyan-400" bg="bg-cyan-500/10 border-cyan-500/20" />
      </div>

      {/* Proteções Ativas */}
      <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
        <div className="p-4 border-b border-border/20">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            Proteções Ativas
          </h3>
        </div>
        <div className="divide-y divide-border/10">
          <ProtectionRow title="Row Level Security (RLS)" description="Todas as tabelas têm RLS habilitado com políticas específicas por role" />
          <ProtectionRow title="Proteção de Perfil" description="Usuários não podem alterar: is_vip, is_dev, banned_until, free_messages_used, IP, fingerprint" />
          <ProtectionRow title="User Roles Lockdown" description="Apenas admins podem inserir, atualizar ou deletar roles" />
          <ProtectionRow title="License Keys" description="Resgate via SECURITY DEFINER function com validação de propriedade" />
          <ProtectionRow title="Anti-Clone" description="Detecção de fingerprint e IP duplicado via functions seguras" />
          <ProtectionRow title="Admin Actions" description="Ações admin (VIP, ban, delete) passam por verificação de role no edge function" />
          <ProtectionRow title="CORS Headers" description="Todas as edge functions têm CORS configurado" />
        </div>
      </div>

      {/* Findings Ignorados */}
      {showIgnored && (
        <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
          <div className="p-4 border-b border-border/20">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Findings Ignorados (Não Aplicáveis)
            </h3>
          </div>
          <div className="divide-y divide-border/10">
            <FindingRow
              level="warn"
              name="Realtime Messages - Sem RLS"
              description="Schema reservado do Supabase (realtime.*) não pode ser modificado. As tabelas de dados já têm RLS."
              expanded={expandedFinding === "realtime"}
              onToggle={() => setExpandedFinding(expandedFinding === "realtime" ? null : "realtime")}
            />
            <FindingRow
              level="warn"
              name="License Keys - UPDATE sem policy de user"
              description="Resgate é feito via SECURITY DEFINER function (redeem_license_key). Nenhum acesso direto UPDATE é dado a usuários."
              expanded={expandedFinding === "license"}
              onToggle={() => setExpandedFinding(expandedFinding === "license" ? null : "license")}
            />
          </div>
        </div>
      )}

      {/* Tabela de Políticas RLS */}
      <div className="rounded-2xl border border-border/30 bg-card/50 overflow-hidden">
        <div className="p-4 border-b border-border/20">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Políticas RLS por Tabela
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/20 text-muted-foreground">
                <th className="text-left p-3 font-medium">Tabela</th>
                <th className="text-center p-3 font-medium">SELECT</th>
                <th className="text-center p-3 font-medium">INSERT</th>
                <th className="text-center p-3 font-medium">UPDATE</th>
                <th className="text-center p-3 font-medium">DELETE</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/10">
              <PolicyRow table="profiles" select="own+admin" insert="own" update="own(restrito)+admin" del="—" />
              <PolicyRow table="user_roles" select="own" insert="admin" update="admin" del="admin" />
              <PolicyRow table="chat_conversations" select="own+admin" insert="own" update="own" del="own" />
              <PolicyRow table="chat_messages" select="own+admin" insert="own" update="—" del="own" />
              <PolicyRow table="chat_shared_rooms" select="participantes+admin" insert="admin" update="—" del="—" />
              <PolicyRow table="chat_shared_messages" select="participantes+admin" insert="participantes+admin" update="—" del="—" />
              <PolicyRow table="chat_connections" select="own+admin" insert="own" update="admin" del="—" />
              <PolicyRow table="support_tickets" select="own+admin" insert="own" update="own+admin" del="—" />
              <PolicyRow table="support_messages" select="own+admin" insert="own+admin" update="—" del="—" />
              <PolicyRow table="license_keys" select="own+admin" insert="admin" update="admin" del="admin" />
              <PolicyRow table="admin_notes" select="admin" insert="admin" update="admin" del="admin" />
              <PolicyRow table="admin_presence" select="todos" insert="admin" update="admin" del="—" />
              <PolicyRow table="chat_customization" select="own" insert="own" update="own" del="—" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon: Icon, label, value, color, bg }: { icon: typeof ShieldCheck; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-xl border p-3 ${bg}`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function ProtectionRow({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function FindingRow({ level, name, description, expanded, onToggle }: { level: string; name: string; description: string; expanded?: boolean; onToggle?: () => void }) {
  return (
    <div className="px-4 py-3 cursor-pointer hover:bg-muted/20 transition-colors" onClick={onToggle}>
      <div className="flex items-center gap-3">
        {level === "error" ? <ShieldAlert className="w-4 h-4 text-red-400 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{name}</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">IGNORADO</span>
          </div>
          {expanded && <p className="text-xs text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
    </div>
  );
}

function PolicyRow({ table, select, insert, update, del }: { table: string; select: string; insert: string; update: string; del: string }) {
  const cellClass = (val: string) => {
    if (val === "—") return "text-muted-foreground/50";
    if (val.includes("admin")) return "text-primary";
    return "text-emerald-400";
  };

  return (
    <tr className="hover:bg-muted/10">
      <td className="p-3 font-mono text-foreground">{table}</td>
      <td className={`p-3 text-center ${cellClass(select)}`}>{select}</td>
      <td className={`p-3 text-center ${cellClass(insert)}`}>{insert}</td>
      <td className={`p-3 text-center ${cellClass(update)}`}>{update}</td>
      <td className={`p-3 text-center ${cellClass(del)}`}>{del}</td>
    </tr>
  );
}

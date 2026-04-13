import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Loader2, Link2, Users } from "lucide-react";
import { toast } from "sonner";

interface ConnectionRequest {
  id: string;
  requester_id: string;
  target_email: string;
  target_user_id: string | null;
  status: string;
  created_at: string;
  requester_name?: string;
  target_name?: string;
}

export function AdminConnectionsPanel() {
  const [connections, setConnections] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("chat_connections")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Erro ao carregar conexões");
      setLoading(false);
      return;
    }

    if (data && data.length > 0) {
      const userIds = [...new Set([
        ...data.map(c => c.requester_id),
        ...data.filter(c => c.target_user_id).map(c => c.target_user_id!)
      ])];
      
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);

      const namesMap: Record<string, string> = {};
      (profiles || []).forEach(p => { namesMap[p.user_id] = p.display_name || "Sem nome"; });

      setConnections(data.map(c => ({
        ...c,
        requester_name: namesMap[c.requester_id] || "Desconhecido",
        target_name: c.target_user_id ? namesMap[c.target_user_id] || c.target_email : c.target_email,
      })));
    } else {
      setConnections([]);
    }
    setLoading(false);
  };

  useEffect(() => { fetchConnections(); }, []);

  const handleApprove = async (connection: ConnectionRequest) => {
    setActionLoading(connection.id);
    try {
      // Find target user by email if not set
      let targetUserId = connection.target_user_id;
      if (!targetUserId) {
        // Try to find user by email in profiles (we can't query auth.users)
        // The edge function will handle this
        toast.error("Usuário alvo não encontrado no sistema");
        setActionLoading(null);
        return;
      }

      // Update connection status
      const { error: updateError } = await supabase
        .from("chat_connections")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", connection.id);

      if (updateError) throw updateError;

      // Create shared room
      const { error: roomError } = await supabase
        .from("chat_shared_rooms")
        .insert({
          connection_id: connection.id,
          user1_id: connection.requester_id,
          user2_id: targetUserId,
          title: `Chat: ${connection.requester_name} & ${connection.target_name}`,
        });

      if (roomError) throw roomError;

      toast.success("Conexão aprovada! Sala criada.");
      fetchConnections();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar conexão");
    }
    setActionLoading(null);
  };

  const handleReject = async (connectionId: string) => {
    setActionLoading(connectionId);
    try {
      const { error } = await supabase
        .from("chat_connections")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", connectionId);

      if (error) throw error;
      toast.success("Conexão rejeitada");
      fetchConnections();
    } catch {
      toast.error("Erro ao rejeitar conexão");
    }
    setActionLoading(null);
  };

  const statusColors: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    rejected: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center gap-2 mb-6">
        <Link2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Pedidos de Conexão</h2>
        <span className="text-xs text-muted-foreground ml-2">
          {connections.filter(c => c.status === "pending").length} pendentes
        </span>
      </div>

      {connections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum pedido de conexão ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <div
              key={conn.id}
              className="bg-card/50 border border-border/30 rounded-xl p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium truncate">{conn.requester_name}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm font-medium truncate">{conn.target_name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[conn.status] || ""}`}>
                    {statusLabels[conn.status] || conn.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(conn.created_at).toLocaleDateString("pt-BR")}
                  </span>
                </div>
              </div>

              {conn.status === "pending" && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleApprove(conn)}
                    disabled={actionLoading === conn.id}
                    className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                  >
                    {actionLoading === conn.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleReject(conn.id)}
                    disabled={actionLoading === conn.id}
                    className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

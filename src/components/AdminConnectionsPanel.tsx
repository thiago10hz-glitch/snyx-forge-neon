import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, X, Loader2, Link2, Users, Trash2, MessageSquare } from "lucide-react";
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

interface SharedRoom {
  id: string;
  title: string;
  connection_id: string;
  user1_id: string;
  user2_id: string;
  is_active: boolean;
  created_at: string;
  message_count?: number;
}

export function AdminConnectionsPanel() {
  const [connections, setConnections] = useState<ConnectionRequest[]>([]);
  const [rooms, setRooms] = useState<SharedRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchConnections = async () => {
    setLoading(true);
    const [connResult, roomResult] = await Promise.all([
      supabase.from("chat_connections").select("*").order("created_at", { ascending: false }),
      supabase.from("chat_shared_rooms").select("*").order("created_at", { ascending: false }),
    ]);

    const data = connResult.data || [];
    const roomData = roomResult.data || [];

    if (data.length > 0) {
      const userIds = [...new Set([
        ...data.map(c => c.requester_id),
        ...data.filter(c => c.target_user_id).map(c => c.target_user_id!),
        ...roomData.map(r => r.user1_id),
        ...roomData.map(r => r.user2_id),
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

    // Count messages per room
    const roomsWithCounts: SharedRoom[] = [];
    for (const room of roomData) {
      const { count } = await supabase
        .from("chat_shared_messages")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);
      roomsWithCounts.push({ ...room, message_count: count || 0 });
    }
    setRooms(roomsWithCounts);
    setLoading(false);
  };

  useEffect(() => { fetchConnections(); }, []);

  const handleApprove = async (connection: ConnectionRequest) => {
    setActionLoading(connection.id);
    try {
      let targetUserId = connection.target_user_id;
      if (!targetUserId) {
        const { data: foundId, error: findErr } = await supabase
          .rpc("find_user_by_email", { p_email: connection.target_email });

        if (findErr || !foundId) {
          toast.error("Usuário alvo não encontrado. Ele precisa se cadastrar primeiro!");
          setActionLoading(null);
          return;
        }
        targetUserId = foundId as string;

        await supabase
          .from("chat_connections")
          .update({ target_user_id: targetUserId })
          .eq("id", connection.id);
      }

      const { error: updateError } = await supabase
        .from("chat_connections")
        .update({ status: "approved", updated_at: new Date().toISOString() })
        .eq("id", connection.id);

      if (updateError) throw updateError;

      const { error: roomError } = await supabase
        .from("chat_shared_rooms")
        .insert({
          connection_id: connection.id,
          user1_id: connection.requester_id,
          user2_id: targetUserId,
          title: `Chat: ${connection.requester_name} & ${connection.target_name}`,
        });

      if (roomError) throw roomError;

      toast.success("Conexão aprovada! Sala criada. ✅");
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

  const handleDeleteConnection = async (connection: ConnectionRequest) => {
    if (!confirm(`Excluir conexão entre ${connection.requester_name} e ${connection.target_name}? Isso remove a sala e todas as mensagens.`)) return;

    setActionLoading(connection.id);
    try {
      // Find and delete associated shared rooms + messages
      const relatedRooms = rooms.filter(r => r.connection_id === connection.id);
      for (const room of relatedRooms) {
        await supabase.from("chat_shared_messages").delete().eq("room_id", room.id);
        await supabase.from("chat_shared_rooms").delete().eq("id", room.id);
      }

      // Delete the connection itself
      const { error } = await supabase
        .from("chat_connections")
        .delete()
        .eq("id", connection.id);

      if (error) throw error;
      toast.success("Conexão excluída! Pode aprovar novas agora. 🗑️");
      fetchConnections();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir conexão");
    }
    setActionLoading(null);
  };

  const statusColors: Record<string, string> = {
    pending: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
    approved: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
    rejected: "text-red-400 bg-red-500/10 border-red-500/30",
  };

  const statusLabels: Record<string, string> = {
    pending: "⏳ Pendente",
    approved: "✅ Aprovado",
    rejected: "❌ Rejeitado",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Link2 className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">Pedidos de Conexão</h2>
        <span className="text-xs text-muted-foreground ml-2">
          {connections.filter(c => c.status === "pending").length} pendentes
        </span>
      </div>

      {/* Connections List */}
      {connections.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Nenhum pedido de conexão ainda</p>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => {
            const connRoom = rooms.find(r => r.connection_id === conn.id);
            return (
              <div
                key={conn.id}
                className="bg-card/50 border border-border/30 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium truncate">{conn.requester_name}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                      <span className="text-sm font-medium truncate">{conn.target_name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[conn.status] || ""}`}>
                        {statusLabels[conn.status] || conn.status}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(conn.created_at).toLocaleDateString("pt-BR")}
                      </span>
                      {connRoom && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {connRoom.message_count} msgs
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {conn.status === "pending" && (
                      <>
                        <button
                          onClick={() => handleApprove(conn)}
                          disabled={actionLoading === conn.id}
                          className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                          title="Aprovar"
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
                          title="Rejeitar"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* Delete button for approved/rejected */}
                    {(conn.status === "approved" || conn.status === "rejected") && (
                      <button
                        onClick={() => handleDeleteConnection(conn)}
                        disabled={actionLoading === conn.id}
                        className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50"
                        title="Excluir conexão"
                      >
                        {actionLoading === conn.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Show email target for clarity */}
                <div className="text-xs text-muted-foreground">
                  Email alvo: <span className="text-foreground/70">{conn.target_email}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
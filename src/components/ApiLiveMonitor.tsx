import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Globe2, Zap, AlertCircle, CheckCircle2, MapPin, Link2, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface UsageLog {
  id: string;
  created_at: string;
  api_client_id: string;
  user_id: string;
  model: string | null;
  provider: string;
  status_code: number;
  latency_ms: number | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  referer: string | null;
  origin: string | null;
  user_agent: string | null;
  request_id: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  error_message: string | null;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 5) return "agora";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

function flagFromCountry(country: string | null): string {
  if (!country) return "🌍";
  const map: Record<string, string> = {
    "Brazil": "🇧🇷", "Brasil": "🇧🇷", "BR": "🇧🇷",
    "United States": "🇺🇸", "US": "🇺🇸",
    "Portugal": "🇵🇹", "PT": "🇵🇹",
    "Argentina": "🇦🇷", "AR": "🇦🇷",
    "Germany": "🇩🇪", "DE": "🇩🇪",
    "United Kingdom": "🇬🇧", "GB": "🇬🇧",
    "France": "🇫🇷", "FR": "🇫🇷",
    "Spain": "🇪🇸", "ES": "🇪🇸",
    "Mexico": "🇲🇽", "MX": "🇲🇽",
    "Canada": "🇨🇦", "CA": "🇨🇦",
    "Japan": "🇯🇵", "JP": "🇯🇵",
    "China": "🇨🇳", "CN": "🇨🇳",
    "India": "🇮🇳", "IN": "🇮🇳",
  };
  return map[country] || "🌍";
}

function shortUA(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("python")) return "Python SDK";
  if (ua.includes("node")) return "Node.js";
  if (ua.includes("curl")) return "cURL";
  if (ua.includes("Postman")) return "Postman";
  return ua.slice(0, 24);
}

function hostnameFrom(url: string | null): string | null {
  if (!url) return null;
  try { return new URL(url).hostname; } catch { return url.slice(0, 32); }
}

export default function ApiLiveMonitor() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [pulse, setPulse] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase
        .from("api_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (mounted && data) setLogs(data as UsageLog[]);
    })();
    return () => { mounted = false; };
  }, []);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("api-usage-live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "api_usage_logs" }, (payload) => {
        const newLog = payload.new as UsageLog;
        setLogs((prev) => [newLog, ...prev].slice(0, 200));
        setPulse(newLog.id);
        setTimeout(() => setPulse(null), 1500);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // Auto-refresh "agora/Xs" labels
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Aggregations
  const ipMap = useMemo(() => {
    const map = new Map<string, { count: number; lastSeen: string; country: string | null; city: string | null; ua: string | null }>();
    for (const l of logs) {
      if (!l.ip_address) continue;
      const cur = map.get(l.ip_address);
      if (cur) {
        cur.count++;
        if (l.created_at > cur.lastSeen) cur.lastSeen = l.created_at;
      } else {
        map.set(l.ip_address, { count: 1, lastSeen: l.created_at, country: l.country, city: l.city, ua: l.user_agent });
      }
    }
    return Array.from(map.entries()).map(([ip, d]) => ({ ip, ...d })).sort((a, b) => b.count - a.count);
  }, [logs]);

  const originMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs) {
      const host = hostnameFrom(l.origin) || hostnameFrom(l.referer) || "(direto/SDK)";
      map.set(host, (map.get(host) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const stats = useMemo(() => {
    const ok = logs.filter(l => l.status_code === 200).length;
    const err = logs.length - ok;
    const avgLat = logs.length ? Math.round(logs.reduce((s, l) => s + (l.latency_ms || 0), 0) / logs.length) : 0;
    const countries = new Set(logs.map(l => l.country).filter(Boolean)).size;
    return { ok, err, avgLat, countries, total: logs.length, ips: ipMap.length };
  }, [logs, ipMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
          </span>
          <h3 className="font-mono text-lg font-bold">Live Monitor — API SnyX</h3>
        </div>
        <Badge variant="outline" className="font-mono text-xs">tempo real · últimas 200</Badge>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <StatPill icon={<Activity className="h-3.5 w-3.5" />} label="Total" value={stats.total} />
        <StatPill icon={<CheckCircle2 className="h-3.5 w-3.5 text-green-500" />} label="OK" value={stats.ok} />
        <StatPill icon={<AlertCircle className="h-3.5 w-3.5 text-red-500" />} label="Erros" value={stats.err} />
        <StatPill icon={<Zap className="h-3.5 w-3.5 text-yellow-500" />} label="Lat. média" value={`${stats.avgLat}ms`} />
        <StatPill icon={<Globe2 className="h-3.5 w-3.5 text-blue-500" />} label="Países" value={stats.countries} />
        <StatPill icon={<MapPin className="h-3.5 w-3.5 text-orange-500" />} label="IPs únicos" value={stats.ips} />
      </div>

      <Tabs defaultValue="stream" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="stream">Stream Ao Vivo</TabsTrigger>
          <TabsTrigger value="ips">IPs ({ipMap.length})</TabsTrigger>
          <TabsTrigger value="origins">Origens ({originMap.length})</TabsTrigger>
        </TabsList>

        {/* STREAM */}
        <TabsContent value="stream" className="mt-3">
          <div className="max-h-[500px] overflow-auto rounded-lg border border-border bg-card/40 backdrop-blur">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                <tr className="text-left font-mono">
                  <th className="px-3 py-2">Quando</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Modelo</th>
                  <th className="px-3 py-2">IP / Local</th>
                  <th className="px-3 py-2">Origem</th>
                  <th className="px-3 py-2">UA</th>
                  <th className="px-3 py-2 text-right">Lat.</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-8 text-center text-muted-foreground">
                    Nenhuma chamada ainda. Quando alguém usar a API, aparece aqui ao vivo.
                  </td></tr>
                )}
                {logs.map((l) => (
                  <tr
                    key={l.id}
                    className={`border-t border-border/50 transition-colors ${pulse === l.id ? "bg-primary/20" : "hover:bg-muted/30"}`}
                  >
                    <td className="px-3 py-2 font-mono text-muted-foreground">{timeAgo(l.created_at)}</td>
                    <td className="px-3 py-2">
                      <Badge variant={l.status_code === 200 ? "default" : "destructive"} className="font-mono text-[10px]">
                        {l.status_code}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 font-mono text-primary">{l.model || "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <span>{flagFromCountry(l.country)}</span>
                        <span className="font-mono">{l.ip_address || "—"}</span>
                        {l.city && <span className="text-muted-foreground">· {l.city}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate" title={l.referer || l.origin || ""}>
                      {hostnameFrom(l.origin) || hostnameFrom(l.referer) || <span className="text-muted-foreground">(SDK direto)</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{shortUA(l.user_agent)}</td>
                    <td className="px-3 py-2 text-right font-mono">{l.latency_ms ?? "—"}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* IPs */}
        <TabsContent value="ips" className="mt-3">
          <div className="max-h-[500px] overflow-auto rounded-lg border border-border bg-card/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="text-left font-mono">
                  <th className="px-3 py-2">IP</th>
                  <th className="px-3 py-2">Local</th>
                  <th className="px-3 py-2">User-Agent</th>
                  <th className="px-3 py-2 text-right">Requests</th>
                  <th className="px-3 py-2 text-right">Visto</th>
                </tr>
              </thead>
              <tbody>
                {ipMap.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum IP registrado ainda.</td></tr>
                )}
                {ipMap.map((row) => (
                  <tr key={row.ip} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono">{flagFromCountry(row.country)} {row.ip}</td>
                    <td className="px-3 py-2">{[row.city, row.country].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-muted-foreground"><Smartphone className="inline h-3 w-3 mr-1" />{shortUA(row.ua)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">{row.count}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{timeAgo(row.lastSeen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ORIGINS */}
        <TabsContent value="origins" className="mt-3">
          <div className="max-h-[500px] overflow-auto rounded-lg border border-border bg-card/40">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="text-left font-mono">
                  <th className="px-3 py-2">Site / Origem</th>
                  <th className="px-3 py-2 text-right">Requests</th>
                </tr>
              </thead>
              <tbody>
                {originMap.length === 0 && (
                  <tr><td colSpan={2} className="px-3 py-8 text-center text-muted-foreground">Nenhuma origem registrada ainda.</td></tr>
                )}
                {originMap.map(([host, count]) => (
                  <tr key={host} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2 font-mono"><Link2 className="inline h-3 w-3 mr-1.5 text-primary" />{host}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatPill({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card/60 px-3 py-2">
      {icon}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="font-mono text-sm font-bold">{value}</div>
      </div>
    </div>
  );
}

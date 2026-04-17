import { Link } from "react-router-dom";
import { LucideIcon, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactNode, useState } from "react";

export interface RailItem {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  dot?: boolean;
  /** Visualmente agrupa este item com o anterior (sem separador, encostado) */
  groupedWithPrev?: boolean;
}

interface SideRailProps {
  logo: ReactNode;
  topItems: RailItem[];
  bottomItems: RailItem[];
  /** Conteúdo extra renderizado no topo (ex: presence indicator). Visível só quando expandido OU em modo compacto centrado. */
  headerExtra?: ReactNode;
  /** Conteúdo extra antes dos bottomItems (ex: badges + avatar). */
  footerExtra?: ReactNode;
}

/**
 * Sidebar fina, com botão lateral pra expandir e mostrar os labels.
 * Quando expandida fica wider (180px) com nomes dos itens.
 */
export function SideRail({ logo, topItems, bottomItems }: SideRailProps) {
  const [expanded, setExpanded] = useState(false);

  const renderItem = (item: RailItem, idx: number) => {
    const Icon = item.icon;
    const tone = item.active
      ? "text-primary bg-primary/12 border-primary/30 shadow-[0_0_18px_-6px_hsl(var(--primary)/0.55)]"
      : item.danger
        ? "text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 border-transparent hover:border-destructive/25"
        : item.accent
          ? "text-amber-300/75 hover:text-amber-200 hover:bg-amber-500/10 border-transparent hover:border-amber-400/30"
          : "text-muted-foreground/65 hover:text-foreground hover:bg-foreground/[0.05] border-transparent hover:border-foreground/10";

    const inner = (
      <button
        onClick={item.onClick}
        className={`group relative ${expanded ? "w-full h-10 px-2.5 justify-start gap-2.5" : "w-10 h-10 justify-center"} rounded-2xl border flex items-center transition-all duration-300 ease-out hover:scale-[1.04] active:scale-[0.96] ${tone}`}
      >
        {item.active && (
          <span className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
        )}
        {/* glow halo on hover */}
        <span className="pointer-events-none absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.18),transparent_70%)]" aria-hidden />
        <Icon className="relative w-[17px] h-[17px] shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:drop-shadow-[0_0_6px_hsl(var(--primary)/0.55)]" strokeWidth={1.85} />
        {expanded && (
          <span className="relative text-[12px] font-semibold tracking-tight truncate">{item.label}</span>
        )}
        {item.dot && (
          <span className={`absolute ${expanded ? "top-2 right-2" : "top-1.5 right-1.5"} w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-pulse`} />
        )}
      </button>
    );

    const wrapper = item.to ? <Link to={item.to}>{inner}</Link> : <div>{inner}</div>;

    if (expanded) {
      return <div key={idx} className={item.groupedWithPrev ? "-mt-1" : ""}>{wrapper}</div>;
    }

    return (
      <Tooltip key={idx}>
        <TooltipTrigger asChild>
          <div className={item.groupedWithPrev ? "-mt-1" : ""}>{wrapper}</div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="text-[11px] font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={`hidden md:flex shrink-0 flex-col z-30 relative transition-[width] duration-300 ease-out ${expanded ? "w-[180px]" : "w-[60px]"}`}
    >
      <div className="absolute inset-0 bg-sidebar/85 backdrop-blur-2xl border-r border-sidebar-border/40" />
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/15 to-transparent" />

      {/* Botão de puxar/recolher */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="absolute top-1/2 -right-3 -translate-y-1/2 z-40 w-6 h-12 rounded-r-xl rounded-l-md bg-card/95 backdrop-blur-xl border border-border/40 border-l-0 flex items-center justify-center text-muted-foreground/70 hover:text-primary hover:border-primary/40 hover:shadow-[0_0_18px_-4px_hsl(var(--primary)/0.5)] transition-all group"
        title={expanded ? "Recolher" : "Expandir"}
        aria-label={expanded ? "Recolher menu" : "Expandir menu"}
      >
        <ChevronRight
          className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""} group-hover:scale-110`}
          strokeWidth={2.5}
        />
      </button>

      <div className="relative flex-1 flex flex-col items-center min-h-0 py-3">
        <div className="mb-3">{logo}</div>
        <div className="h-px w-8 bg-border/30 mb-3" />
        <nav className={`flex-1 flex flex-col gap-1.5 overflow-y-auto scrollbar-hide w-full px-[10px] ${expanded ? "items-stretch" : "items-center"}`}>
          {topItems.map(renderItem)}
        </nav>
        <div className="h-px w-8 bg-border/30 my-3" />
        <div className={`flex flex-col gap-1.5 w-full px-[10px] ${expanded ? "items-stretch" : "items-center"}`}>
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
        </div>
      </div>
    </aside>
  );
}

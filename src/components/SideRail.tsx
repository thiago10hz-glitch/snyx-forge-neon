import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ReactNode } from "react";

export interface RailItem {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  dot?: boolean;
  groupedWithPrev?: boolean;
  /** Rótulo de seção exibido ACIMA deste item */
  sectionLabel?: string;
}

interface SideRailProps {
  logo: ReactNode;
  brandName?: string;
  topItems: RailItem[];
  bottomItems: RailItem[];
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
  children?: ReactNode;
  collapsed?: boolean;
}

/**
 * Sidebar com dois modos:
 * - collapsed=true (oculta, w=0)
 * - collapsed=false (expandida ~240px com logo, ícones+rótulos e lista de conversas)
 */
export function SideRail({
  logo,
  brandName = "SnyX",
  topItems,
  bottomItems,
  headerExtra,
  footerExtra,
  children,
  collapsed = false,
}: SideRailProps) {
  const expanded = !collapsed;

  const renderItem = (item: RailItem, idx: number) => {
    const Icon = item.icon;
    const tone = item.active
      ? "text-primary bg-primary/10"
      : item.danger
        ? "text-muted-foreground/65 hover:text-destructive hover:bg-card/40"
        : item.accent
          ? "text-amber-300/80 hover:text-amber-200 hover:bg-card/40"
          : "text-muted-foreground/70 hover:text-foreground hover:bg-card/40";

    const inner = (
      <button
        onClick={item.onClick}
        className={`group relative flex items-center w-full h-9 px-3 gap-3 rounded-md transition-colors duration-200 ${tone}`}
        aria-label={item.label}
      >
        <Icon className="w-[15px] h-[15px] shrink-0" strokeWidth={1.7} />
        <span className="text-[13px] font-medium truncate">{item.label}</span>
        {item.dot && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))] animate-pulse" />
        )}
      </button>
    );

    const wrapper = item.to ? (
      <Link to={item.to} className="block w-full">{inner}</Link>
    ) : (
      <div className="w-full">{inner}</div>
    );

    return (
      <div key={idx} className={`w-full ${item.groupedWithPrev ? "-mt-0.5" : ""}`}>
        {item.sectionLabel && (
          <div className="px-3 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
            {item.sectionLabel}
          </div>
        )}
        {wrapper}
      </div>
    );
  };

  if (!expanded) {
    return (
      <aside className="flex shrink-0 flex-col z-30 relative overflow-hidden transition-[width] duration-300 ease-out w-0 bg-sidebar-background" />
    );
  }

  return (
    <aside className="flex shrink-0 flex-col z-30 relative overflow-hidden transition-[width] duration-300 ease-out w-[260px] bg-sidebar-background border-r border-border/40">
      {/* Header: logo + nome (espaço pro botão de toggle no topo) */}
      <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-3 pl-12">
        <div className="shrink-0">{logo}</div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">{brandName}</span>
      </div>

      {headerExtra && <div className="px-2 pb-2">{headerExtra}</div>}

      {/* Itens de navegação */}
      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        {topItems.map(renderItem)}
      </nav>

      {/* Lista de conversas (estilo ChatGPT) */}
      {children && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 border-t border-border/30 pt-2">
          {children}
        </div>
      )}

      {/* Footer */}
      {(footerExtra || bottomItems.length > 0) && (
        <div className="border-t border-border/30 px-2 py-2 flex flex-col gap-1">
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
          {footerExtra && <div className="pt-1">{footerExtra}</div>}
        </div>
      )}
    </aside>
  );
}

// Compat: tooltip removido (não usado mais no modo expandido)
export const _UnusedTooltip = { Tooltip, TooltipContent, TooltipTrigger };

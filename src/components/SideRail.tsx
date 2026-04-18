import { Link } from "react-router-dom";
import { LucideIcon, ChevronDown } from "lucide-react";
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
  red?: boolean;
  dot?: boolean;
  groupedWithPrev?: boolean;
  /** Tailwind text color class for the icon, e.g. "text-pink-400" */
  iconColor?: string;
  /** Rótulo de seção exibido ACIMA deste item (legado, sem colapsar) */
  sectionLabel?: string;
  /** Chave de grupo colapsável; itens com mesma key viram grupo */
  group?: string;
}

export interface RailGroup {
  key: string;
  label: string;
  icon?: LucideIcon;
  defaultOpen?: boolean;
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
  /** Grupos colapsáveis. Itens sem group ficam soltos no topo. */
  groups?: RailGroup[];
}

export function SideRail({
  logo,
  brandName = "SnyX",
  topItems,
  bottomItems,
  headerExtra,
  footerExtra,
  children,
  collapsed = false,
  groups = [],
}: SideRailProps) {
  const expanded = !collapsed;

  // Estado dos grupos: começa com defaultOpen ou true se contém item ativo
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    groups.forEach((g) => {
      const hasActive = topItems.some((i) => i.group === g.key && i.active);
      init[g.key] = hasActive || g.defaultOpen !== false;
    });
    return init;
  });

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const renderItem = (item: RailItem, idx: number, indent = false) => {
    const Icon = item.icon;
    const tone = item.active
      ? "text-foreground bg-white/[0.06]"
      : "text-foreground/70 hover:text-foreground hover:bg-white/[0.04]";

    const iconColorClass = item.iconColor
      ? `${item.iconColor} drop-shadow-[0_0_6px_currentColor]`
      : "";

    const inner = (
      <button
        onClick={item.onClick}
        className={`group relative flex items-center w-full h-9 ${indent ? "pl-6 pr-3" : "px-3"} gap-3 rounded-md transition-colors duration-150 ${tone}`}
        aria-label={item.label}
      >
        <Icon className={`w-[15px] h-[15px] shrink-0 ${iconColorClass}`} strokeWidth={1.9} />
        <span className="text-[13px] font-medium truncate">{item.label}</span>
        {item.dot && (
          <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-foreground/70" />
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
          <div className="px-3 pt-3 pb-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/55">
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

  // Separa itens soltos vs por grupo
  const looseItems = topItems.filter((i) => !i.group);
  const itemsByGroup: Record<string, RailItem[]> = {};
  groups.forEach((g) => {
    itemsByGroup[g.key] = topItems.filter((i) => i.group === g.key);
  });

  return (
    <aside className="flex shrink-0 flex-col z-30 relative overflow-hidden transition-[width] duration-300 ease-out w-[260px] bg-sidebar-background border-r border-border/40">
      <div className="flex items-center gap-2.5 px-3 pt-3.5 pb-3 pl-12">
        <div className="shrink-0">{logo}</div>
        <span className="text-[15px] font-semibold tracking-tight text-foreground">{brandName}</span>
      </div>

      {headerExtra && <div className="px-2 pb-2">{headerExtra}</div>}

      <nav className="flex flex-col gap-0.5 px-2 pb-2">
        {looseItems.map((item, i) => renderItem(item, i))}

        {groups.map((g) => {
          const items = itemsByGroup[g.key] || [];
          if (items.length === 0) return null;
          const isOpen = !!openGroups[g.key];
          const GroupIcon = g.icon;
          return (
            <div key={g.key} className="mt-2">
              <button
                onClick={() => toggleGroup(g.key)}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/60 hover:text-foreground/80 transition-colors rounded-md"
              >
                {GroupIcon && <GroupIcon className="w-3 h-3" strokeWidth={2.2} />}
                <span className="flex-1 text-left">{g.label}</span>
                <ChevronDown
                  className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-0" : "-rotate-90"}`}
                  strokeWidth={2.2}
                />
              </button>
              {isOpen && (
                <div className="flex flex-col gap-0.5 mt-0.5">
                  {items.map((item, i) => renderItem(item, 100 + i, true))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {children && (
        <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-2 border-t border-border/30 pt-2">
          {children}
        </div>
      )}

      {(footerExtra || bottomItems.length > 0) && (
        <div className="border-t border-border/30 px-2 py-2 flex flex-col gap-1">
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
          {footerExtra && <div className="pt-1">{footerExtra}</div>}
        </div>
      )}
    </aside>
  );
}

export const _UnusedTooltip = { Tooltip, TooltipContent, TooltipTrigger };

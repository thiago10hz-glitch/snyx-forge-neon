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
}

interface SideRailProps {
  logo: ReactNode;
  topItems: RailItem[];
  bottomItems: RailItem[];
  headerExtra?: ReactNode;
  footerExtra?: ReactNode;
  collapsed?: boolean;
}

/**
 * Sidebar com dois modos:
 * - collapsed=true (estreita ~44px, só ícones)
 * - collapsed=false (expandida ~200px, ícones + rótulos)
 */
export function SideRail({ logo, topItems, bottomItems, headerExtra, footerExtra, collapsed = false }: SideRailProps) {
  const expanded = !collapsed;

  const renderItem = (item: RailItem, idx: number) => {
    const Icon = item.icon;
    const tone = item.active
      ? "text-primary"
      : item.danger
        ? "text-muted-foreground/55 hover:text-destructive"
        : item.accent
          ? "text-amber-300/70 hover:text-amber-200"
          : "text-muted-foreground/55 hover:text-foreground";

    const inner = (
      <button
        onClick={item.onClick}
        className={`group relative flex items-center transition-colors duration-200 ${tone} ${
          expanded
            ? "w-full h-9 px-3 gap-3 rounded-md hover:bg-card/40"
            : "w-8 h-8 justify-center"
        }`}
        aria-label={item.label}
      >
        <Icon
          className={`${expanded ? "w-[15px] h-[15px]" : "w-[14px] h-[14px]"} shrink-0 transition-transform duration-200 group-hover:scale-110`}
          strokeWidth={1.5}
        />
        {expanded && (
          <span className="text-[12.5px] font-medium truncate">{item.label}</span>
        )}
        {item.dot && (
          <span className={`absolute ${expanded ? "top-2 right-2" : "top-1 right-1"} w-1 h-1 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))] animate-pulse`} />
        )}
      </button>
    );

    const wrapper = item.to ? (
      <Link to={item.to} className={expanded ? "block w-full" : ""}>{inner}</Link>
    ) : (
      <div className={expanded ? "w-full" : ""}>{inner}</div>
    );

    if (expanded) {
      return (
        <div key={idx} className={`w-full ${item.groupedWithPrev ? "-mt-0.5" : ""}`}>
          {wrapper}
        </div>
      );
    }

    return (
      <Tooltip key={idx}>
        <TooltipTrigger asChild>
          <div className={item.groupedWithPrev ? "-mt-0.5" : ""}>{wrapper}</div>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={12} className="text-[11px] font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className={`flex shrink-0 flex-col z-30 relative overflow-hidden transition-[width] duration-300 ease-out bg-background ${
        expanded ? "w-[200px]" : "w-0"
      }`}
    >
      <div className="absolute top-0 right-0 bottom-0 w-px bg-primary/15" />

      <div className={`relative flex-1 flex flex-col min-h-0 py-3 ${expanded ? "items-stretch px-2 pt-12" : "items-center"}`}>
        <div className={`mb-3 ${expanded ? "pl-1" : ""}`}>{logo}</div>
        {headerExtra && <div className={`mb-2 ${expanded ? "" : "flex justify-center"}`}>{headerExtra}</div>}

        <nav className={`flex-1 flex flex-col overflow-y-auto scrollbar-hide w-full ${expanded ? "gap-1" : "items-center gap-1.5"}`}>
          {topItems.map(renderItem)}
        </nav>

        {footerExtra && (
          <div className={`mt-2 mb-1 flex flex-col gap-1.5 ${expanded ? "" : "items-center"}`}>{footerExtra}</div>
        )}
        <div className={`flex flex-col gap-1 w-full ${expanded ? "" : "items-center"}`}>
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
        </div>
      </div>
    </aside>
  );
}

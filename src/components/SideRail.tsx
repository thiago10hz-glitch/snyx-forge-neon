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
}

/**
 * Rail super estreita estilo SKYNETchat: ~52px, só ícones pequenos centralizados,
 * divisor vertical vermelho sutil à direita, sem expansão.
 */
export function SideRail({ logo, topItems, bottomItems, headerExtra, footerExtra }: SideRailProps) {
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
        className={`group relative w-9 h-9 flex items-center justify-center transition-colors duration-200 ${tone}`}
        aria-label={item.label}
      >
        <Icon className="w-4 h-4 transition-transform duration-200 group-hover:scale-110" strokeWidth={1.5} />
        {item.dot && (
          <span className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-primary shadow-[0_0_5px_hsl(var(--primary))] animate-pulse" />
        )}
      </button>
    );

    const wrapper = item.to ? <Link to={item.to}>{inner}</Link> : <div>{inner}</div>;

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
    <aside className="hidden md:flex shrink-0 flex-col z-30 relative w-[52px]">
      {/* divisor vermelho bem sutil à direita, sem fundo opaco */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-primary/15" />

      <div className="relative flex-1 flex flex-col items-center min-h-0 py-3">
        <div className="mb-3">{logo}</div>
        {headerExtra && <div className="mb-2 flex justify-center">{headerExtra}</div>}

        <nav className="flex-1 flex flex-col items-center gap-2 overflow-y-auto scrollbar-hide w-full">
          {topItems.map(renderItem)}
        </nav>

        {footerExtra && (
          <div className="mt-2 mb-1 flex flex-col items-center gap-1.5">{footerExtra}</div>
        )}
        <div className="flex flex-col items-center gap-1 w-full">
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
        </div>
      </div>
    </aside>
  );
}

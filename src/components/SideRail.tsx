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
}

interface SideRailProps {
  logo: ReactNode;
  topItems: RailItem[];
  bottomItems: RailItem[];
}

/**
 * Sidebar fina, fixa, sempre visível. Sem alça, sem expandir.
 * Tooltips no hover mostram o label.
 */
export function SideRail({ logo, topItems, bottomItems }: SideRailProps) {
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
        className={`relative w-10 h-10 rounded-2xl border flex items-center justify-center transition-all duration-200 ${tone}`}
      >
        {item.active && (
          <span className="absolute -left-[9px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary shadow-[0_0_10px_hsl(var(--primary))]" />
        )}
        <Icon className="w-[17px] h-[17px]" strokeWidth={1.85} />
        {item.dot && (
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-pulse" />
        )}
      </button>
    );

    return (
      <Tooltip key={idx}>
        <TooltipTrigger asChild>
          {item.to ? <Link to={item.to}>{inner}</Link> : <div>{inner}</div>}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10} className="text-[11px] font-medium">
          {item.label}
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside className="hidden md:flex shrink-0 flex-col w-[60px] z-30 relative">
      <div className="absolute inset-0 bg-sidebar/85 backdrop-blur-2xl border-r border-sidebar-border/40" />
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/15 to-transparent" />

      <div className="relative flex-1 flex flex-col items-center min-h-0 py-3">
        <div className="mb-3">{logo}</div>
        <div className="h-px w-8 bg-border/30 mb-3" />
        <nav className="flex-1 flex flex-col items-center gap-1.5 overflow-y-auto scrollbar-hide w-full px-[10px]">
          {topItems.map(renderItem)}
        </nav>
        <div className="h-px w-8 bg-border/30 my-3" />
        <div className="flex flex-col items-center gap-1.5 w-full px-[10px]">
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
        </div>
      </div>
    </aside>
  );
}

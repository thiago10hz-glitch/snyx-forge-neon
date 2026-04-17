import { useState, ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";

export interface SidebarItem {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  to?: string;
  active?: boolean;
  danger?: boolean;
  accent?: boolean;
  dot?: boolean;
  badge?: string;
}

interface CinematicSidebarProps {
  logo: ReactNode;
  topItems: SidebarItem[];
  bottomItems: SidebarItem[];
  groupDivider?: { afterIndex: number; label: string }[];
}

/**
 * Sidebar cinemática: w-16 quando idle, expande pra w-64 no hover.
 * - Glassmorphism, glow vermelho sutil, divisores etéreos
 * - Labels com fade-in conforme expande
 * - Pill ativo com barra lateral primary
 */
export function CinematicSidebar({ logo, topItems, bottomItems, groupDivider = [] }: CinematicSidebarProps) {
  const [expanded, setExpanded] = useState(false);

  const renderItem = (item: SidebarItem, idx: number) => {
    const Icon = item.icon;
    const baseTone = item.active
      ? "text-primary"
      : item.danger
        ? "text-muted-foreground/70 group-hover/it:text-destructive"
        : item.accent
          ? "text-amber-300/80 group-hover/it:text-amber-200"
          : "text-muted-foreground/70 group-hover/it:text-foreground";

    const bgTone = item.active
      ? "bg-primary/12 border-primary/30 shadow-[0_0_24px_-6px_hsl(var(--primary)/0.5)]"
      : item.danger
        ? "border-transparent group-hover/it:bg-destructive/8 group-hover/it:border-destructive/20"
        : item.accent
          ? "border-transparent group-hover/it:bg-amber-500/8 group-hover/it:border-amber-500/20"
          : "border-transparent group-hover/it:bg-foreground/[0.04] group-hover/it:border-foreground/10";

    const inner = (
      <div
        className={`group/it relative h-11 mx-2 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden ${bgTone}`}
        onClick={item.onClick}
      >
        {/* active rail */}
        {item.active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        )}

        <div className="relative h-full flex items-center">
          {/* icon column - always w-12 to keep alignment */}
          <div className="w-12 shrink-0 flex items-center justify-center">
            <div className="relative">
              <Icon className={`w-[18px] h-[18px] transition-colors ${baseTone}`} strokeWidth={1.8} />
              {item.dot && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-pulse" />
              )}
            </div>
          </div>

          {/* label - fades + slides in */}
          <span
            className={`text-[13px] font-medium tracking-tight whitespace-nowrap transition-all duration-300 ${
              expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
            } ${baseTone}`}
          >
            {item.label}
          </span>

          {item.badge && expanded && (
            <span className="ml-auto mr-3 text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
              {item.badge}
            </span>
          )}
        </div>
      </div>
    );

    const wrapped = item.to ? (
      <Link to={item.to} key={idx} className="block">
        {inner}
      </Link>
    ) : (
      <div key={idx}>{inner}</div>
    );

    const dividerAfter = groupDivider.find((d) => d.afterIndex === idx);
    return (
      <div key={`g-${idx}`}>
        {wrapped}
        {dividerAfter && (
          <div className="my-3 mx-4 flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
            <span
              className={`text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground/30 transition-opacity duration-300 ${
                expanded ? "opacity-100" : "opacity-0"
              }`}
            >
              {dividerAfter.label}
            </span>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-border/40 to-transparent" />
          </div>
        )}
      </div>
    );
  };

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={`hidden md:flex shrink-0 flex-col z-30 relative transition-[width] duration-300 ease-out ${
        expanded ? "w-64" : "w-16"
      }`}
    >
      {/* Glass shell */}
      <div className="absolute inset-0 bg-[hsl(0_0%_6%/0.85)] backdrop-blur-2xl border-r border-border/15" />
      {/* Soft inner glow on right edge */}
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Logo header */}
        <div className="h-16 shrink-0 flex items-center px-3.5 border-b border-border/10 overflow-hidden">
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">{logo}</div>
          <span
            className={`ml-3 text-[15px] font-black tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent whitespace-nowrap transition-all duration-300 ${
              expanded ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2 pointer-events-none"
            }`}
          >
            SnyX
          </span>
        </div>

        <nav className="flex-1 py-3 space-y-1 overflow-y-auto scrollbar-hide">
          {topItems.map(renderItem)}
        </nav>

        <div className="py-3 border-t border-border/10 space-y-1">
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
        </div>

        {/* Hover hint dot pill on edge when collapsed */}
        <div
          className={`absolute right-[-4px] top-1/2 -translate-y-1/2 w-1 h-10 rounded-full bg-primary/0 transition-all duration-300 ${
            expanded ? "bg-primary/0" : "bg-primary/30 shadow-[0_0_10px_hsl(var(--primary)/0.5)]"
          }`}
        />
      </div>
    </aside>
  );
}

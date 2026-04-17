import { useState, useRef, useEffect, useCallback, ReactNode } from "react";
import { Link } from "react-router-dom";
import { LucideIcon, GripVertical } from "lucide-react";

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

const COLLAPSED_W = 64;
const EXPANDED_W = 256;
const SNAP_THRESHOLD = 140;

/**
 * Sidebar com alça arrastável (drawer style):
 * - Alça vertical na borda direita: arrasta pra abrir/fechar
 * - Clique simples na alça também alterna
 * - Sem hover-expand: só ação intencional
 */
export function CinematicSidebar({ logo, topItems, bottomItems, groupDivider = [] }: CinematicSidebarProps) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(COLLAPSED_W);
  const [dragging, setDragging] = useState(false);
  const dragStartXRef = useRef<number | null>(null);
  const startWidthRef = useRef(COLLAPSED_W);
  const movedRef = useRef(false);

  // Sync width when expanded toggles externally (click)
  useEffect(() => {
    if (!dragging) setWidth(expanded ? EXPANDED_W : COLLAPSED_W);
  }, [expanded, dragging]);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    dragStartXRef.current = e.clientX;
    startWidthRef.current = width;
    movedRef.current = false;
    setDragging(true);
  }, [width]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (dragStartXRef.current === null) return;
    const dx = e.clientX - dragStartXRef.current;
    if (Math.abs(dx) > 4) movedRef.current = true;
    const next = Math.max(COLLAPSED_W, Math.min(EXPANDED_W + 32, startWidthRef.current + dx));
    setWidth(next);
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);
    dragStartXRef.current = null;
    if (!movedRef.current) {
      // treat as click → toggle
      setExpanded((v) => !v);
      return;
    }
    // snap based on final width
    const shouldOpen = width > SNAP_THRESHOLD;
    setExpanded(shouldOpen);
    setWidth(shouldOpen ? EXPANDED_W : COLLAPSED_W);
  }, [dragging, width]);

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
      ? "bg-primary/10 border-primary/25 shadow-[0_0_24px_-8px_hsl(var(--primary)/0.55)]"
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
        {item.active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full bg-primary shadow-[0_0_12px_hsl(var(--primary))]" />
        )}

        <div className="relative h-full flex items-center">
          <div className="w-12 shrink-0 flex items-center justify-center">
            <div className="relative">
              <Icon className={`w-[18px] h-[18px] transition-colors ${baseTone}`} strokeWidth={1.8} />
              {item.dot && (
                <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_hsl(var(--primary))] animate-pulse" />
              )}
            </div>
          </div>

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
      style={{ width }}
      className={`hidden md:flex shrink-0 flex-col z-30 relative ${
        dragging ? "transition-none" : "transition-[width] duration-300 ease-out"
      } select-none`}
    >
      {/* Glass shell */}
      <div className="absolute inset-0 bg-sidebar/85 backdrop-blur-2xl border-r border-sidebar-border/50" />
      <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-primary/20 to-transparent" />

      <div className="relative flex-1 flex flex-col min-h-0">
        {/* Logo header */}
        <div className="h-16 shrink-0 flex items-center px-3.5 border-b border-sidebar-border/40 overflow-hidden">
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

        <div className="py-3 border-t border-sidebar-border/40 space-y-1">
          {bottomItems.map((item, idx) => renderItem(item, 1000 + idx))}
        </div>
      </div>

      {/* === DRAG HANDLE === */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        className={`absolute top-1/2 -translate-y-1/2 -right-3 h-20 w-6 flex items-center justify-center cursor-ew-resize z-40 group ${
          dragging ? "" : "transition-transform"
        }`}
        title="Arraste pra abrir/fechar — clique pra alternar"
        aria-label="Alternar barra lateral"
      >
        <div
          className={`h-16 w-2 rounded-full border transition-all duration-300 flex items-center justify-center ${
            expanded
              ? "bg-primary/20 border-primary/40 shadow-[0_0_16px_-2px_hsl(var(--primary)/0.6)]"
              : "bg-sidebar/90 border-sidebar-border/60 group-hover:bg-primary/15 group-hover:border-primary/40 group-hover:shadow-[0_0_14px_-2px_hsl(var(--primary)/0.5)]"
          }`}
        >
          <GripVertical
            className={`w-3 h-3 transition-colors ${
              expanded ? "text-primary" : "text-muted-foreground/60 group-hover:text-primary"
            }`}
          />
        </div>
      </div>
    </aside>
  );
}

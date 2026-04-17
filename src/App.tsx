import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Loader2 } from "lucide-react";
import { initSnyxSecurity, setSnyxOwnerMode } from "@/lib/snyxSecurity";

// Eager imports — all pages loaded upfront for instant navigation
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import OwnerPanel from "./pages/OwnerPanel";
import IPTV from "./pages/IPTV";
import Hosting from "./pages/Hosting";
import ResetPassword from "./pages/ResetPassword";
import Downloads from "./pages/Downloads";
import PackSteam from "./pages/PackSteam";
import NotFound from "./pages/NotFound";
import SiteManage from "./pages/SiteManage";

import CheckoutReturn from "./pages/CheckoutReturn";
import Accelerator from "./pages/Accelerator";
import Optimization from "./pages/Optimization";
import CloneSite from "./pages/CloneSite";
import Videos from "./pages/Videos";
import { CommandPalette } from "./components/CommandPalette";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 min cache
      gcTime: 10 * 60 * 1000, // 10 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <Loader2 className="h-8 w-8 animate-spin text-primary" />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function CopyProtection() {
  const { isAdmin, profile } = useAuth();
  const isOwner = isAdmin || profile?.team_badge === "Dona" || profile?.team_badge === "Primeira-Dama";

  React.useEffect(() => {
    // Set owner mode in security module
    setSnyxOwnerMode(!!isOwner);

    if (isOwner) {
      document.documentElement.style.userSelect = '';
      document.documentElement.style.webkitUserSelect = '';
      return;
    }

    // Block copy/cut/select for non-owners
    document.documentElement.style.userSelect = 'none';
    (document.documentElement.style as any).webkitUserSelect = 'none';

    const blockCopy = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      e.preventDefault();
    };
    const blockSelect = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || (target as HTMLElement).isContentEditable) return;
      e.preventDefault();
    };

    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCopy);
    document.addEventListener('selectstart', blockSelect);

    return () => {
      document.documentElement.style.userSelect = '';
      (document.documentElement.style as any).webkitUserSelect = '';
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      document.removeEventListener('selectstart', blockSelect);
    };
  }, [isOwner]);

  return null;
}

const App = () => {
  // Initialize SnyX-SEC protection layer
  React.useEffect(() => {
    initSnyxSecurity();
  }, []);

  // Drag protection (all users)
  React.useEffect(() => {
    const handleDragStart = (e: DragEvent) => e.preventDefault();
    document.addEventListener('dragstart', handleDragStart);
    return () => document.removeEventListener('dragstart', handleDragStart);
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CopyProtection />
            <CommandPalette />
            <ThemeProvider>
              <Routes>
                  <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
                  <Route path="/auth" element={<PublicRoute><Auth /></PublicRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                  <Route path="/dono" element={<ProtectedRoute><OwnerPanel /></ProtectedRoute>} />
                  <Route path="/iptv" element={<ProtectedRoute><IPTV /></ProtectedRoute>} />
                  <Route path="/hosting" element={<ProtectedRoute><Hosting /></ProtectedRoute>} />
                  <Route path="/downloads" element={<ProtectedRoute><Downloads /></ProtectedRoute>} />
                  <Route path="/pack-steam" element={<ProtectedRoute><PackSteam /></ProtectedRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  
                  <Route path="/site/:id" element={<ProtectedRoute><SiteManage /></ProtectedRoute>} />
                  <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
                  <Route path="/accelerator" element={<Accelerator />} />
                  <Route path="/optimization" element={<Optimization />} />
                  <Route path="/clone-site" element={<ProtectedRoute><CloneSite /></ProtectedRoute>} />
                  <Route path="/videos" element={<ProtectedRoute><Videos /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

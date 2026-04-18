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

import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Admin from "./pages/Admin";
import OwnerPanel from "./pages/OwnerPanel";
import AdminAIPool from "./pages/AdminAIPool";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import ApiPricing from "./pages/ApiPricing";
import CheckoutReturn from "./pages/CheckoutReturn";
import DevBuilder from "./pages/DevBuilder";
import Programador from "./pages/Programador";
import Promo from "./pages/Promo";
import Atendimento from "./pages/Atendimento";
import RpgCatalog from "./pages/RpgCatalog";
import RpgCreate from "./pages/RpgCreate";
import RpgChat from "./pages/RpgChat";
import MyRpg from "./pages/MyRpg";
import Musica from "./pages/Musica";
import { CommandPalette } from "./components/CommandPalette";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
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
    setSnyxOwnerMode(!!isOwner);

    if (isOwner) {
      document.documentElement.style.userSelect = '';
      (document.documentElement.style as any).webkitUserSelect = '';
      return;
    }

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
  React.useEffect(() => { initSnyxSecurity(); }, []);
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
                <Route path="/admin/ai-pool" element={<ProtectedRoute><AdminAIPool /></ProtectedRoute>} />
                <Route path="/dono" element={<ProtectedRoute><OwnerPanel /></ProtectedRoute>} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/api" element={<ApiPricing />} />
                <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
                <Route path="/dev-builder" element={<ProtectedRoute><DevBuilder /></ProtectedRoute>} />
                <Route path="/programador" element={<ProtectedRoute><Programador /></ProtectedRoute>} />
                <Route path="/promo" element={<Promo />} />
                <Route path="/atendimento" element={<ProtectedRoute><Atendimento /></ProtectedRoute>} />
                <Route path="/rpg" element={<ProtectedRoute><RpgCatalog /></ProtectedRoute>} />
                <Route path="/rpg/minha-conta" element={<ProtectedRoute><MyRpg /></ProtectedRoute>} />
                <Route path="/rpg/criar" element={<ProtectedRoute><RpgCreate /></ProtectedRoute>} />
                <Route path="/rpg/c/:id" element={<ProtectedRoute><RpgChat /></ProtectedRoute>} />
                <Route path="/musica" element={<ProtectedRoute><Musica /></ProtectedRoute>} />
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

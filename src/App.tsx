import React, { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "@/hooks/useTheme";
import { Loader2 } from "lucide-react";

// Lazy load all pages for code splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const OwnerPanel = lazy(() => import("./pages/OwnerPanel"));
const IPTV = lazy(() => import("./pages/IPTV"));
const Hosting = lazy(() => import("./pages/Hosting"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Downloads = lazy(() => import("./pages/Downloads"));
const PackSteam = lazy(() => import("./pages/PackSteam"));
const NotFound = lazy(() => import("./pages/NotFound"));
const SiteManage = lazy(() => import("./pages/SiteManage"));
const Characters = lazy(() => import("./pages/Characters"));
const CheckoutReturn = lazy(() => import("./pages/CheckoutReturn"));
const Accelerator = lazy(() => import("./pages/Accelerator"));
const Optimization = lazy(() => import("./pages/Optimization"));
const CloneSite = lazy(() => import("./pages/CloneSite"));
const Demo = lazy(() => import("./pages/Demo"));
const CommandPalette = lazy(() => import("./components/CommandPalette").then(m => ({ default: m.CommandPalette })));

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
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = React.useState(false);

  React.useEffect(() => {
    if (!user) return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => {
        setIsAdmin(!!data);
      });
    });
  }, [user]);

  React.useEffect(() => {
    if (isAdmin) {
      document.documentElement.style.userSelect = '';
      return;
    }

    // Block copy/cut/select for non-admins
    document.documentElement.style.userSelect = 'none';

    const blockCopy = (e: ClipboardEvent) => {
      if (!isAdmin) e.preventDefault();
    };
    const blockSelect = (e: Event) => {
      if (!isAdmin) e.preventDefault();
    };

    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCopy);
    document.addEventListener('selectstart', blockSelect);

    return () => {
      document.documentElement.style.userSelect = '';
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      document.removeEventListener('selectstart', blockSelect);
    };
  }, [isAdmin]);

  return null;
}

const App = () => {
  React.useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'F12' ||
        (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(e.key.toUpperCase())) ||
        (e.ctrlKey && ['U', 'S', 'C', 'A'].includes(e.key.toUpperCase()))
      ) {
        e.preventDefault();
      }
    };
    const handleDragStart = (e: DragEvent) => e.preventDefault();

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('dragstart', handleDragStart);

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <CopyProtection />
            <Suspense fallback={null}>
              <CommandPalette />
            </Suspense>
            <ThemeProvider>
              <Suspense fallback={<PageLoader />}>
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
                  <Route path="/characters" element={<ProtectedRoute><Characters /></ProtectedRoute>} />
                  <Route path="/site/:id" element={<ProtectedRoute><SiteManage /></ProtectedRoute>} />
                  <Route path="/checkout/return" element={<ProtectedRoute><CheckoutReturn /></ProtectedRoute>} />
                  <Route path="/accelerator" element={<Accelerator />} />
                  <Route path="/optimization" element={<Optimization />} />
                  <Route path="/clone-site" element={<ProtectedRoute><CloneSite /></ProtectedRoute>} />
                  <Route path="/demo" element={<ProtectedRoute><Demo /></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ThemeProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;

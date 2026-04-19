// Force rebuild for Supabase integration
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/lib/SupabaseProvider';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Settings, 
  LogOut, 
  Search, 
  Bell, 
  TrendingUp, 
  Zap, 
  Calendar,
  Plus,
  ArrowRight,
  Target,
  MapPin,
  Building2,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  AlertCircle,
  ShieldAlert,
  Camera,
  User,
  Trash2,
  Upload,
  Download,
  FileText,
  HelpCircle,
  MoreVertical,
  Mail as MailIcon,
  Grid,
  Kanban,
  ArrowUpDown,
  CreditCard,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Filter,
  BarChart3,
  MousePointer2
} from 'lucide-react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  eachDayOfInterval, 
  isToday,
  parseISO
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Cropper from 'react-easy-crop';
import Papa from 'papaparse';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import {
  DndContext, 
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<string> => {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (error) => reject(error));
    img.src = imageSrc;
  });

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('No 2d context');

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;

  ctx.drawImage(
    image,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    pixelCrop.width,
    pixelCrop.height
  );

  return canvas.toDataURL('image/jpeg');
};

const calculateAge = (birthday: string) => {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  if (isNaN(birthDate.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
};

const getCleanClient = (client: any) => {
  if (!client) return null;
  return { ...client };
};

const getClientPhoto = (client: any) => {
  const clean = getCleanClient(client);
  const url = clean?.foto_url;
  if (!url || url.includes('picsum.photos')) return null;
  return url;
};

const getCleanOthers = (others: string | null) => {
  if (!others) return 'Nenhuma nota registrada.';
  const clean = getCleanClient({ outros: others });
  return clean?.outros || 'Nenhuma nota registrada.';
};

// Types
type View = 'dashboard' | 'clients' | 'pipeline' | 'settings' | 'client-detail' | 'portfolio' | 'financial' | 'analytics' | 'calendar';

// --- Helper Functions ---

const cleanPhoneNumberForWhatsApp = (phone: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  // Se tiver 10 ou 11 dígitos (DDD + número), adiciona o código do Brasil (55)
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
};

export default function Home() {
  const { user, profile } = useSupabase();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    activePipeline: 0,
    salesThisMonth: 0
  });
  const [dbError, setDbError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshClientsData = () => setRefreshKey(prev => prev + 1);

  const updateMetrics = (clientList: any[]) => {
    const activePipelineValue = clientList
      .filter(c => c.status !== 'Fechado' && c.status !== 'Perdido')
      .reduce((acc, c) => acc + (Number(c.valor_buscado) || 0), 0);
    
    const salesValue = clientList
      .filter(c => c.status === 'Fechado')
      .reduce((acc, c) => acc + (Number(c.valor_buscado) || 0), 0);

    setMetrics({
      totalClients: clientList.length,
      activePipeline: activePipelineValue,
      salesThisMonth: salesValue
    });
  };

  useEffect(() => {
    if (!user) return;

    // Fetch initial clients
    const fetchClients = async () => {
      try {
        if (!supabase) {
          console.error("[DIAGNOSTIC] Supabase client is not initialized");
          setDbError("Cliente Supabase não inicializado.");
          return;
        }
        
        console.log("[DIAGNOSTIC] Fetching clients for user:", user.id);
        const { data, error } = await supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) {
          const detailedError: any = {};
          Object.getOwnPropertyNames(error).forEach(key => {
            detailedError[key] = (error as any)[key];
          });
          
          console.error("[DIAGNOSTIC] Supabase error fetching clients:", detailedError);
          setDbError(`Erro no banco de dados: ${error.message || 'Erro desconhecido'}`);
          
          if (error.code === 'PGRST204' || error.message?.includes('column')) {
            console.warn("[DIAGNOSTIC] Column mismatch detected. This usually means the database schema is out of sync with the code.");
          }
          if (error.code === '42P01') {
            console.warn("[DIAGNOSTIC] Table 'clients' does not exist.");
          }
        } else if (data) {
          console.log("[DIAGNOSTIC] Clients fetched successfully:", data.length);
          setClients(data);
          updateMetrics(data);
          setDbError(null);
        }
      } catch (err: any) {
        console.error("[DIAGNOSTIC] Unexpected exception in fetchClients:", err.message || err);
        setDbError(`Exceção inesperada: ${err.message || 'Erro desconhecido'}`);
      }
    };

    fetchClients();

    const fetchAppointments = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('appointments')
          .select('*, clients(nome)')
          .eq('user_id', user.id)
          .order('start_time', { ascending: true });
        
        if (error) throw error;
        setAppointments(data || []);
      } catch (err: any) {
        console.error("Error fetching appointments:", err);
      }
    };

    fetchAppointments();

    // Subscribe to changes
    const channel = supabase
      .channel('db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshKey]);

  useEffect(() => {
    if (!user || clients.length === 0) return;
    const cleanup = async () => {
      const hallucinativeIds = clients
        .filter(c => c.foto_url && (c.foto_url.includes('picsum.photos') || c.foto_url.includes('seed')))
        .map(c => c.id);
        
      if (hallucinativeIds.length > 0) {
        console.log(`[CLEANUP] Found ${hallucinativeIds.length} hallucinative photos. Cleaning up...`);
        await supabase
          .from('clients')
          .update({ foto_url: null })
          .in('id', hallucinativeIds);
        setRefreshKey(prev => prev + 1);
      }
    };
    cleanup();
  }, [user, clients]);

  const handleLogout = () => supabase.auth.signOut();

  const closeSidebar = () => setIsSidebarOpen(false);

  const openClientDetail = (id: string) => {
    setSelectedClientId(id);
    setActiveView('client-detail');
  };

  const updateClientStatus = async (clientId: string, newStatus: string) => {
    try {
      if (!supabase) return;
      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', clientId);
      
      if (error) throw error;
      refreshClientsData();
    } catch (err) {
      console.error("Error updating client status:", err);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans relative">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation */}
      <aside className={`fixed lg:sticky left-0 top-0 h-full w-72 bg-white border-r border-slate-100 z-50 flex flex-col transition-transform duration-300 lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {dbError && (
          <div className="bg-red-600 text-white p-2 text-[0.6rem] font-bold text-center flex flex-col gap-1 items-center">
            <div className="animate-pulse">⚠️ ERRO DE BANCO: {dbError}</div>
            <button 
              onClick={() => window.location.reload()}
              className="px-2 py-1 bg-white/20 hover:bg-white/30 rounded uppercase tracking-tighter"
            >
              Recarregar App
            </button>
          </div>
        )}
        <div className="px-8 py-10 flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-200">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">Gestão de Carteira</h1>
            <p className="text-[0.6rem] uppercase font-bold tracking-widest text-slate-400 mt-1">Inteligência Imobiliária</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: 'dashboard', label: 'Início', icon: '📊' },
            { id: 'calendar', label: 'Agendamentos', icon: '📅' },
            { id: 'clients', label: 'Clientes', icon: '👥' },
            { id: 'pipeline', label: 'Vendas', icon: '📈' },
            { id: 'portfolio', label: 'Imóveis', icon: '🏠' },
            { id: 'financial', label: 'Financeiro', icon: '💰' },
            { id: 'analytics', label: 'Relatórios', icon: '📋' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveView(item.id as View);
                setSelectedClientId(null);
                closeSidebar();
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
                activeView === item.id
                  ? 'text-blue-600 font-bold bg-blue-50' 
                  : 'text-slate-500 font-medium hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="px-6 py-10 space-y-2 border-t border-slate-50">
          <button 
            onClick={() => {
              setActiveView('settings');
              closeSidebar();
            }}
            className={`w-full flex items-center gap-4 px-5 py-3 rounded-xl transition-all text-sm font-medium ${
              activeView === 'settings' 
                ? 'text-blue-600 font-bold bg-blue-50' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Settings className={`w-5 h-5 ${activeView === 'settings' ? 'text-blue-600' : 'text-slate-300'}`} />
            Settings
          </button>
          <button className="w-full flex items-center gap-4 px-5 py-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all text-sm font-medium">
            <HelpCircle className="w-5 h-5 text-slate-300" />
            Help Center
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-5 py-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all text-sm font-medium mt-4"
          >
            <LogOut className="w-5 h-5 text-slate-300" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen w-full overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white px-4 md:px-8 py-4 md:py-6 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-4 md:gap-8">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 lg:hidden text-slate-500 hover:bg-slate-50 rounded-lg transition-all"
            >
              <Grid className="w-6 h-6" />
            </button>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-900 truncate max-w-[200px] md:max-w-none">
                {activeView === 'dashboard' ? 'Painel de Controle' : 
                 activeView === 'clients' ? 'Lista de Clientes' : 
                 activeView === 'pipeline' ? 'Pipeline de Vendas' : 
                 activeView === 'calendar' ? 'Agendamentos' :
                 activeView === 'portfolio' ? 'Portfólio de Imóveis' :
                 activeView === 'financial' ? 'Gestão Financeira' :
                 activeView === 'analytics' ? 'Relatórios e Análises' : 'Detalhes do Cliente'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center gap-1 md:gap-3">
              <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all relative">
                <MailIcon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all relative">
                <Bell className="w-4 h-4 md:w-5 md:h-5" />
              </button>
            </div>
              <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-6 border-l border-slate-100 group cursor-pointer">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">{profile?.name || user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-slate-400">Corretor</p>
                </div>
                {profile?.photo_url ? (
                  <img 
                    src={profile.photo_url} 
                    alt="Profile" 
                    className="w-8 h-8 md:w-10 md:h-10 rounded-full object-cover bg-slate-100"
                  />
                ) : (
                  <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                    <User className="w-4 h-4 md:w-5 md:h-5" />
                  </div>
                )}
              </div>
          </div>
        </header>

        {/* View Content */}
        <div className="px-4 md:p-8 flex-1 w-full max-w-7xl mx-auto py-6 md:py-8">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && <Dashboard metrics={metrics} clients={clients} appointments={appointments} onClientClick={openClientDetail} onAddLead={() => { setEditingClient(null); setIsLeadModalOpen(true); }} onSchedule={() => setActiveView('calendar')} />}
            {activeView === 'clients' && <ClientLedger clients={clients} onClientClick={openClientDetail} onAddLead={() => { setEditingClient(null); setIsLeadModalOpen(true); }} onRefresh={refreshClientsData} />}
            {activeView === 'calendar' && (
              <CalendarView 
                appointments={appointments} 
                onEdit={(app) => { setEditingAppointment(app); setIsScheduleModalOpen(true); }}
                onAdd={() => { setEditingAppointment(null); setIsScheduleModalOpen(true); }}
              />
            )}
            {activeView === 'pipeline' && (
              <Pipeline 
                clients={clients} 
                onClientClick={openClientDetail} 
                updateClientStatus={updateClientStatus}
                onSchedule={() => setActiveView('calendar')}
              />
            )}
            {activeView === 'client-detail' && selectedClientId && (
              <ClientDetail 
                clientId={selectedClientId} 
                onBack={() => setActiveView('clients')} 
                onEdit={(client) => { setEditingClient(client); setIsLeadModalOpen(true); }}
                onDelete={() => { setSelectedClientId(null); setActiveView('clients'); refreshClientsData(); }}
                onRefresh={refreshClientsData}
              />
            )}
            {activeView === 'settings' && <SettingsView profile={profile} />}
            {['portfolio', 'financial', 'analytics'].includes(activeView) && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400">
                <span className="text-6xl mb-4">🚧</span>
                <h3 className="text-xl font-bold">Em breve</h3>
                <p>Esta funcionalidade está sendo restaurada.</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Lead Modal (Create/Edit) */}
      <LeadModal 
        isOpen={isLeadModalOpen} 
        onClose={() => { setIsLeadModalOpen(false); setEditingClient(null); }} 
        initialData={editingClient}
        onSuccess={refreshClientsData}
      />
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => { setIsScheduleModalOpen(false); setEditingAppointment(null); }}
        initialData={editingAppointment}
        clients={clients}
        onSuccess={refreshClientsData}
      />
    </div>
  );
}

// --- Sub-Views ---

function Dashboard({ metrics, clients, appointments, onClientClick, onAddLead, onSchedule }: { 
  metrics: { totalClients: number, activePipeline: number, salesThisMonth: number }, 
  clients: any[], 
  appointments: any[],
  onClientClick: (id: string) => void, 
  onAddLead: () => void,
  onSchedule: () => void
}) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const stats = [
    { label: 'Total de Clientes', value: metrics.totalClients, trend: '+12%', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { 
      label: 'VGV', 
      value: 'R$ ' + new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2 }).format(metrics.activePipeline), 
      trend: '+5%', 
      icon: Target, 
      color: 'bg-emerald-50 text-emerald-600' 
    },
    { label: 'Vendas este Mês', value: metrics.salesThisMonth, trend: '+2%', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
  ];

  const funnelData = [
    { name: 'Lead', value: clients.filter(c => c.status === 'Ativo').length, fill: '#3b82f6' },
    { name: 'Visita', value: clients.filter(c => c.status === 'Visita').length, fill: '#10b981' },
    { name: 'Negociação', value: clients.filter(c => c.status === 'Negociação').length, fill: '#f59e0b' },
    { name: 'Venda', value: clients.filter(c => c.status === 'Fechado').length, fill: '#ef4444' },
  ];

  const recentLeads = [...clients].sort((a, b) => {
    const timeA = Math.max(new Date(a.updated_at || a.created_at).getTime(), new Date(a.created_at).getTime());
    const timeB = Math.max(new Date(b.updated_at || b.created_at).getTime(), new Date(b.created_at).getTime());
    return timeB - timeA;
  }).slice(0, 5);

  const upcomingAppointments = appointments
    .filter(app => new Date(app.start_time) >= new Date())
    .slice(0, 5);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-6 md:space-y-8"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-2xl font-bold text-slate-900">Resumo de Performance</h3>
          <p className="text-xs text-slate-400 mt-1">Acompanhe seus principais indicadores de venda.</p>
        </div>
        <button 
          onClick={onAddLead}
          className="w-full sm:w-auto px-6 py-3 bg-[#0f172a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg"
        >
          <Plus className="w-4 h-4" />
          Novo Lead
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-5 md:p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2.5 md:p-3 rounded-2xl ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
              </div>
              <span className="text-[0.65rem] md:text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">{stat.trend}</span>
            </div>
            <p className="text-xs md:text-sm font-bold text-[#003366]">{stat.label}</p>
            <h4 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">{stat.value}</h4>
          </motion.div>
        ))}
      </div>

      {/* Upcoming Appointments Widget */}
      {upcomingAppointments.length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm"
        >
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Agenda: Próximos Compromissos</h3>
            <button onClick={onSchedule} className="text-xs font-bold text-blue-600 hover:underline">Ver Agenda Completa</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcomingAppointments.map((app) => (
              <div 
                key={app.id} 
                onClick={onSchedule}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className={`p-2 rounded-xl ${
                    app.type === 'visita' ? 'bg-emerald-100 text-emerald-600' :
                    app.type === 'negociação' ? 'bg-amber-100 text-amber-600' :
                    'bg-blue-100 text-blue-600'
                  }`}>
                    {app.type === 'visita' ? <Building2 className="w-4 h-4" /> : 
                     app.type === 'negociação' ? <Zap className="w-4 h-4" /> : 
                     <Calendar className="w-4 h-4" />}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{format(parseISO(app.start_time), 'dd MMM')}</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">{app.title}</h4>
                <div className="flex items-center gap-2 mt-2">
                  <Clock className="w-3 h-3 text-slate-400" />
                  <span className="text-[10px] font-bold text-[#003366]">{format(parseISO(app.start_time), 'HH:mm')}</span>
                  {app.location && (
                    <>
                      <div className="w-1 h-1 rounded-full bg-slate-300" />
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-500 truncate max-w-[80px]">{app.location}</span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-12 gap-8">
        {/* Funnel Chart */}
        <div className="col-span-12 lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h3 className="text-lg font-bold text-slate-900">Funil de Vendas</h3>
            <button className="text-xs font-bold text-blue-600 hover:underline">Ver Detalhes</button>
          </div>
          <div className="h-[250px] md:h-[300px] w-full relative">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" id="dashboard-funnel-container" minHeight={100} debounce={50}>
                <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#003366' }} />
                  <Tooltip 
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="col-span-12 lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-4 md:mb-6">Atividade Recente</h3>
          <div className="space-y-6">
            {recentLeads.map((client, i) => {
              const isUpdate = client.updated_at && (new Date(client.updated_at).getTime() - new Date(client.created_at).getTime() > 60000);
              return (
                <div key={client.id} className="flex items-center gap-4 group cursor-pointer" onClick={() => onClientClick(client.id)}>
                  {getClientPhoto(client) ? (
                    <img 
                      src={getClientPhoto(client)!} 
                      alt="" 
                      className="w-10 h-10 rounded-xl object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
                      <User className="w-5 h-5" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{client.nome}</p>
                    <p className="text-xs text-[#003366] font-bold mt-0.5">{isUpdate ? 'Lead atualizado' : 'Novo lead registrado'}</p>
                  </div>
                  <span className="text-[0.65rem] font-bold text-[#003366]">
                    {format(new Date(client.updated_at || client.created_at), 'HH:mm')}
                  </span>
                </div>
              );
            })}
          </div>
          <button className="w-full mt-8 py-3 bg-slate-50 text-slate-600 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all">
            Ver Todo Histórico
          </button>
        </div>
      </div>

      {/* Active Leads Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h3 className="text-lg font-bold text-slate-900">Leads Ativos no Portfólio</h3>
          <button className="w-full md:w-auto px-4 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-all">
            Filtrar Leads
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">
                <th className="px-8 py-4">Cliente</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4">Valor</th>
                <th className="px-8 py-4">Última Interação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {clients.slice(0, 5).map((client) => (
                <tr 
                  key={client.id} 
                  onClick={() => onClientClick(client.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-[0.65rem]">
                        {client.nome.substring(0, 2).toUpperCase()}
                      </div>
                      <p className="text-sm font-bold text-slate-900">{client.nome}</p>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-3 py-1 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${
                      client.status === 'Negociação' ? 'bg-emerald-100 text-emerald-600' :
                      client.status === 'Visita' ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {client.status}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-sm font-bold text-slate-900">R$ {client.valor_buscado?.toLocaleString() || '0'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-xs text-slate-400">
                      {client.updated_at ? format(new Date(client.updated_at), 'dd/MM/yyyy') : 'N/A'}
                    </p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}

function ClientLedger({ clients, onClientClick, onAddLead, onRefresh }: { clients: any[], onClientClick: (id: string) => void, onAddLead: () => void, onRefresh: () => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeFilter, setActiveFilter] = useState('Todos');
  const [sortOrder, setSortOrder] = useState<'recent' | 'az'>('recent');
  const [isImporting, setIsImporting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useSupabase();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const excelDateToISO = (val: any) => {
      if (!val || String(val).trim() === '' || String(val).toLowerCase().includes('localizado')) return undefined;
      
      const strVal = String(val).trim();
      
      // Handle DD/MM/YYYY format
      const ddmmyyyy = strVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (ddmmyyyy) {
        const day = ddmmyyyy[1].padStart(2, '0');
        const month = ddmmyyyy[2].padStart(2, '0');
        const year = ddmmyyyy[3];
        return `${year}-${month}-${day}`;
      }

      const numVal = strVal.replace(',', '.');
      const num = Number(numVal);
      
      // Check if it's a valid Excel date number (roughly between year 1900 and 2100)
      if (!isNaN(num) && num > 1 && num < 100000) {
        try {
          const date = new Date((num - 25569) * 86400 * 1000);
          if (!isNaN(date.getTime())) {
            return date.toISOString().split('T')[0];
          }
        } catch {
          return undefined;
        }
      }
      
      // If it's a string, try to parse it normally
      try {
        const date = new Date(strVal);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
          return date.toISOString().split('T')[0];
        }
      } catch {
        // Ignore
      }
      
      return undefined;
    };

    setIsImporting(true);
    
    // Tenta ler como UTF-8 primeiro, se falhar ou tiver caracteres estranhos (comum em Excel BR) usar ISO-8859-1
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      encoding: "ISO-8859-1", // Padrão para Excel no Brasil
      delimiter: ";", // Support semicolon separated files
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            // If semicolon failed, try auto-detect
            if (results.errors[0].code === "TooFewFields") {
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                encoding: "ISO-8859-1",
                complete: async (res) => {
                  await processImport(res.data);
                }
              });
              return;
            }
            throw new Error(`Erro ao processar CSV: ${results.errors[0].message}`);
          }

          await processImport(results.data);
        } catch (err: any) {
          console.error("Import error:", err);
          setNotification({ 
            type: 'error', 
            message: "Erro na importação: " + err.message 
          });
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (error) => {
        setNotification({ 
          type: 'error', 
          message: "Erro ao ler arquivo: " + error.message 
        });
        setIsImporting(false);
      }
    });

    async function processImport(data: any[]) {
      try {
        const importedClients = data.map((row: any) => {
          // Normalize keys to find matches
          const normalizedRow: any = {};
          Object.keys(row).forEach(key => {
            const normalizedKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
            normalizedRow[normalizedKey] = row[key];
          });

          const client: any = {
            user_id: user?.id,
            data_entrada: new Date().toISOString().split('T')[0],
            status: 'Ativo',
            bairros: [],
            historico_conversas: []
          };

          // Map common fields
          if (normalizedRow.nome || normalizedRow.name) client.nome = normalizedRow.nome || normalizedRow.name;
          if (normalizedRow.email) client.email = normalizedRow.email;
          if (normalizedRow.whatsapp) client.whatsapp = normalizedRow.whatsapp;
          if (normalizedRow.telefone || normalizedRow.phone) client.telefone = normalizedRow.telefone || normalizedRow.phone;
          if (normalizedRow.redesocial || normalizedRow.social) client.rede_social = normalizedRow.redesocial || normalizedRow.social;
          if (normalizedRow.documento || normalizedRow.document) client.documento = normalizedRow.documento || normalizedRow.document;
          if (normalizedRow.prof || normalizedRow.profession) client.profissao = normalizedRow.prof || normalizedRow.profession;
          
          client.v_l = normalizedRow.vl || 'Venda';
          client.codigo = normalizedRow.codigo || normalizedRow.code || normalizedRow.cdigo || 'S/C';
          
          if (normalizedRow.aniversario || normalizedRow.birthday) client.aniversario = excelDateToISO(normalizedRow.aniversario || normalizedRow.birthday);
          if (normalizedRow.dataentrada || normalizedRow.entrydate) client.data_entrada = excelDateToISO(normalizedRow.dataentrada || normalizedRow.entrydate);
          
          // Map observations to the correct database field 'outros'
          if (normalizedRow.outros || normalizedRow.others || normalizedRow.obs || normalizedRow.observacoes || normalizedRow.observacao || normalizedRow.notascodigo) {
            client.outros = normalizedRow.outros || normalizedRow.others || normalizedRow.obs || normalizedRow.observacoes || normalizedRow.observacao || normalizedRow.notascodigo;
          }
          
          const valorRaw = normalizedRow.valorbuscado || normalizedRow.valor || normalizedRow.value || normalizedRow.orcamento || normalizedRow.budget || normalizedRow.valorbuscado;
          if (valorRaw) {
            const numVal = String(valorRaw).replace(/[R$\s.]/g, '').replace(',', '.');
            client.valor_buscado = isNaN(Number(numVal)) ? 0 : Number(numVal);
          }

          if (normalizedRow.tipo || normalizedRow.type) client.tipo = normalizedRow.tipo || normalizedRow.type;
          
          // Bairros
          const bairros = [];
          if (normalizedRow.bairro1) bairros.push(normalizedRow.bairro1);
          if (normalizedRow.bairro2) bairros.push(normalizedRow.bairro2);
          if (normalizedRow.bairro3) bairros.push(normalizedRow.bairro3);
          if (bairros.length > 0) {
            client.bairros = bairros;
          } else if (normalizedRow.bairro || normalizedRow.neighborhood) {
            client.bairros = [normalizedRow.bairro || normalizedRow.neighborhood];
          }

          // Additional fields from the user's CSV
          if (normalizedRow.m) client.metragem_quadrada = Number(String(normalizedRow.m).replace(',', '.'));
          if (normalizedRow.andar) client.andar = Number(normalizedRow.andar);
          if (normalizedRow.dormt) client.dormitorios = Number(normalizedRow.dormt);
          if (normalizedRow.suites) client.suites = Number(normalizedRow.suites);
          if (normalizedRow.vagas) client.vagas = Number(normalizedRow.vagas);
          if (normalizedRow.imovenv) client.imovel_enviado = normalizedRow.imovenv;
          if (normalizedRow.feedback) client.feedback = normalizedRow.feedback;
          if (normalizedRow.ultimocontato) client.contato = normalizedRow.ultimocontato;

          return client;
        }).filter(c => c.nome);

        if (importedClients.length === 0) {
          throw new Error("Nenhum cliente válido encontrado no arquivo. Verifique se a coluna 'Nome' existe.");
        }

        const { error } = await supabase.from('clients').insert(importedClients);
        if (error) throw error;
        
        setNotification({ 
          type: 'success', 
          message: `${importedClients.length} clientes importados com sucesso!` 
        });
        onRefresh();
      } catch (err: any) {
        throw err;
      }
    }
  };

  const filters = ['Todos', 'Lead', 'Visita', 'Negociação', 'Venda'];

  const filteredClients = clients.filter(client => {
    const matchesSearch = client.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (client.email && client.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (client.telefone && client.telefone.includes(searchTerm));
    
    if (activeFilter === 'Todos') return matchesSearch;
    if (activeFilter === 'Lead') return matchesSearch && client.status === 'Ativo';
    if (activeFilter === 'Visita') return matchesSearch && client.status === 'Visita';
    if (activeFilter === 'Negociação') return matchesSearch && client.status === 'Negociação';
    if (activeFilter === 'Venda') return matchesSearch && client.status === 'Fechado';
    return matchesSearch;
  }).sort((a, b) => {
    if (sortOrder === 'az') {
      return a.nome.localeCompare(b.nome);
    }
    // Default: Recent (usually handled by the initial query, but let's ensure it)
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Notifications */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-24 right-8 z-[100] px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
              notification.type === 'success' 
                ? 'bg-emerald-50 border-emerald-100 text-emerald-800' 
                : 'bg-red-50 border-red-100 text-red-800'
            }`}
          >
            {notification.type === 'success' ? (
              <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                <Plus className="w-5 h-5 rotate-45" />
              </div>
            ) : (
              <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white">
                <AlertCircle className="w-5 h-5" />
              </div>
            )}
            <p className="text-sm font-bold">{notification.message}</p>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Sub-Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Lista de Clientes</h2>
          <p className="text-xs text-slate-400 mt-1">Gerencie sua base de contatos e importe leads via Excel/CSV.</p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            className="hidden" 
            accept=".csv"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {isImporting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full" /> : <Upload className="w-4 h-4" />}
            Importar CSV
          </button>
          <button className="flex-1 md:flex-none px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all">
            <Download className="w-4 h-4" />
            Exportar
          </button>
          <button 
            onClick={onAddLead}
            className="flex-1 md:flex-none px-6 py-3 bg-[#0f172a] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
          >
            <Plus className="w-4 h-4" />
            Novo Lead
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Buscar por nome, e-mail ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-slate-100 border-none rounded-xl text-sm focus:ring-2 focus:ring-slate-200 transition-all"
          />
        </div>
        
        {/* Sort Select */}
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl w-full md:w-auto">
          <div className="pl-3 pr-1">
             <ArrowUpDown className="w-4 h-4 text-slate-400" />
          </div>
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'recent' | 'az')}
            className="bg-transparent border-none text-xs font-bold text-slate-600 outline-none pr-4 cursor-pointer"
          >
            <option value="recent">Mais Recentes</option>
            <option value="az">Ordem (A a Z)</option>
          </select>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl w-full md:w-auto overflow-x-auto">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-6 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                activeFilter === filter ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden md:grid grid-cols-12 px-8 py-5 border-b border-slate-50 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">
          <div className="col-span-3">Cliente</div>
          <div className="col-span-2">Código / V/L</div>
          <div className="col-span-2">Telefone / WhatsApp</div>
          <div className="col-span-2">Profissão / Doc</div>
          <div className="col-span-2">Status / Atualização</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-slate-50">
          {filteredClients.length === 0 ? (
            <div className="p-20 text-center">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-[#003366] text-sm italic font-bold">Nenhum cliente encontrado com os filtros atuais.</p>
            </div>
          ) : (
            filteredClients.map((client) => (
              <div key={client.id}>
                {/* Desktop View */}
                <div 
                  onClick={() => onClientClick(client.id)}
                  className="hidden md:grid grid-cols-12 px-8 py-6 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <div className="col-span-3 flex items-center gap-4">
                    {getClientPhoto(client) ? (
                      <img 
                        src={getClientPhoto(client)!} 
                        alt="" 
                        className="w-12 h-12 rounded-2xl object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
                        <User className="w-6 h-6" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-slate-900">{client.nome}</p>
                      <p className="text-xs text-[#003366] font-bold mt-0.5">{client.email || 'Sem e-mail'}</p>
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm font-bold text-slate-900">{client.codigo || 'S/C'}</p>
                    <p className="text-[0.65rem] text-[#003366] font-bold uppercase tracking-widest mt-0.5">{client.v_l || 'N/A'}</p>
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-900 font-bold">{[client.whatsapp, client.telefone].filter(Boolean).join(' / ') || 'N/A'}</p>
                      {(client.whatsapp || client.telefone) && (
                        <a 
                          href={`https://wa.me/${cleanPhoneNumberForWhatsApp(client.whatsapp || client.telefone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                          title="Conversar no WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5 fill-current" />
                        </a>
                      )}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-slate-900 font-bold">{client.profissao || 'N/A'}</p>
                    <p className="text-[0.65rem] text-[#003366] font-bold mt-0.5">{client.documento || ''}</p>
                  </div>
                  <div className="col-span-2 flex items-center justify-between pr-8">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          client.status === 'Fechado' ? 'bg-emerald-500' :
                          client.status === 'Visita' ? 'bg-blue-500' :
                          client.status === 'Negociação' ? 'bg-amber-500' :
                          'bg-slate-300'
                        }`}></span>
                        <p className="text-xs font-bold text-slate-900">{client.status}</p>
                      </div>
                      <p className="text-[0.65rem] text-[#003366] font-bold">
                        {client.updated_at ? format(new Date(client.updated_at), 'dd/MM/yyyy') : 'Sem data'}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Mobile Card View */}
                <div 
                  onClick={() => onClientClick(client.id)}
                  className="md:hidden p-5 space-y-4 hover:bg-slate-50 transition-all cursor-pointer border-b last:border-b-0 border-slate-100"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getClientPhoto(client) ? (
                        <img 
                          src={getClientPhoto(client)!} 
                          alt="" 
                          className="w-10 h-10 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
                          <User className="w-5 h-5" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-bold text-slate-900">{client.nome}</p>
                        <p className="text-[0.65rem] text-[#003366] font-bold uppercase tracking-widest">{client.codigo || 'S/C'}</p>
                      </div>
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[0.6rem] font-bold uppercase tracking-widest ${
                      client.status === 'Fechado' ? 'bg-emerald-100 text-emerald-600' :
                      client.status === 'Visita' ? 'bg-blue-100 text-blue-600' :
                      client.status === 'Negociação' ? 'bg-amber-100 text-amber-600' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {client.status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">WhatsApp / Telefone</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-slate-700">{[client.whatsapp, client.telefone].filter(Boolean).join(' / ') || 'N/A'}</p>
                        {(client.whatsapp || client.telefone) && (
                          <a 
                            href={`https://wa.me/${cleanPhoneNumberForWhatsApp(client.whatsapp || client.telefone)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1 px-2 bg-emerald-50 text-emerald-600 rounded-lg"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Tipo</p>
                      <p className="text-xs font-bold text-slate-700">{client.v_l || 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-50">
                    <p className="text-[0.65rem] text-slate-400">
                      Atualizado em: <span className="font-bold text-[#003366]">{client.updated_at ? format(new Date(client.updated_at), 'dd/MM/yyyy') : '---'}</span>
                    </p>
                    <ArrowRight className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function DraggableCard({ 
  client, 
  onClientClick, 
  isStalled, 
  isClosingSoon, 
  onSchedule,
  onFollowUp 
}: { 
  client: any, 
  onClientClick: (id: string) => void, 
  isStalled: boolean, 
  isClosingSoon: boolean,
  onSchedule: () => void,
  onFollowUp: () => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: client.id,
    data: {
      type: 'client',
      client
    }
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="touch-none"
    >
      <motion.div 
        layoutId={client.id}
        onClick={() => !isDragging && onClientClick(client.id)}
        whileHover={{ scale: 1.02 }}
        className={`bg-white rounded-2xl p-4 shadow-sm border transition-all cursor-pointer group relative overflow-hidden ${
          isStalled ? 'border-red-100 bg-red-50/10' : 'border-slate-100'
        } ${isDragging ? 'shadow-2xl border-blue-200' : ''}`}
      >
        {/* Drag Handle */}
        <div {...attributes} {...listeners} className="absolute top-2 left-2 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
          <Grid className="w-3 h-3" />
        </div>

        {isStalled && (
          <div className="absolute top-0 right-0 p-1 bg-red-100 text-red-600 rounded-bl-xl">
            <AlertCircle className="w-3 h-3 animate-pulse" />
          </div>
        )}
        
        <div className="flex items-center gap-3 mb-4 mt-2">
          {getClientPhoto(client) ? (
            <img 
              src={getClientPhoto(client)!} 
              alt="" 
              className="w-10 h-10 rounded-xl object-cover shadow-sm" 
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
              <User className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="font-bold text-slate-900 text-sm truncate group-hover:text-blue-600 transition-colors">{client.nome}</h4>
            <div className="flex items-center gap-1">
              <MapPin className="w-2.5 h-2.5 text-slate-400" />
              <p className="text-[0.6rem] text-slate-400 font-medium truncate">{client.bairros?.[0] || 'Localização não inf.'}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center mb-4">
          <div>
            <p className="text-[0.55rem] font-bold text-[#003366] uppercase tracking-widest opacity-50">Expectativa</p>
            <p className="text-sm font-black text-slate-900">
              R$ {client.valor_buscado ? (client.valor_buscado / 1000).toFixed(0) + 'k' : '---'}
            </p>
          </div>
          <div className="px-2 py-1 bg-slate-50 rounded-lg border border-slate-100">
            <p className="text-[0.55rem] font-bold text-slate-500 uppercase tracking-widest text-center">Tipo</p>
            <p className="text-[0.65rem] font-black text-slate-900 text-center">{client.tipo || 'N/A'}</p>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-slate-50 pt-3">
          <div className="flex items-center gap-1">
            <Clock className={`w-3 h-3 ${isStalled ? 'text-red-500' : 'text-slate-400'}`} />
            <span className={`text-[0.6rem] font-bold ${isStalled ? 'text-red-600' : 'text-slate-500'}`}>
              {isStalled ? 'Lead Parado' : format(new Date(client.updated_at || client.created_at), 'dd/MM')}
            </span>
          </div>
          <div className="flex gap-1">
            {isClosingSoon && (
              <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Target className="w-3 h-3" />
              </div>
            )}
            <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
              <MousePointer2 className="w-3 h-3" />
            </div>
          </div>
        </div>

        {/* Automation Suggestions */}
        <AnimatePresence>
          {client.status === 'Visita' && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 pt-3 border-t border-dashed border-purple-100"
            >
              <button 
                onClick={(e) => { e.stopPropagation(); onSchedule(); }}
                className="w-full py-2 bg-purple-50 text-purple-700 text-[0.6rem] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 hover:bg-purple-100 transition-colors"
              >
                <Calendar className="w-3 h-3" /> Sugerir Visita
              </button>
            </motion.div>
          )}
          {isStalled && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              className="mt-3 pt-3 border-t border-dashed border-red-100"
            >
              <button 
                onClick={(e) => { e.stopPropagation(); onFollowUp(); }}
                className="w-full py-2 bg-red-50 text-red-700 text-[0.6rem] font-black uppercase tracking-widest rounded-lg flex items-center justify-center gap-2 hover:bg-red-100 transition-colors"
              >
                <Phone className="w-3 h-3" /> Realizar Follow-up
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function Pipeline({ 
  clients, 
  onClientClick, 
  updateClientStatus,
  onSchedule 
}: { 
  clients: any[], 
  onClientClick: (id: string) => void,
  updateClientStatus: (id: string, status: string) => void,
  onSchedule: () => void 
}) {
  const [funnelView, setFunnelView] = useState<'kanban' | 'analytics'>('kanban');
  const [filterType, setFilterType] = useState<string>('all');
  const [stages, setStages] = useState([
    { id: 'Ativo', label: 'Novos Leads', color: 'bg-blue-500' },
    { id: 'Em Atendimento', label: 'Em Atendimento', color: 'bg-amber-500' },
    { id: 'Visita', label: 'Visitas', color: 'bg-purple-500' },
    { id: 'Negociação', label: 'Negociação', color: 'bg-emerald-500' },
    { id: 'Fechado', label: 'Fechados', color: 'bg-slate-900' }
  ]);
  const [activeClient, setActiveClient] = useState<any>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredClients = clients.filter(c => filterType === 'all' || c.tipo === filterType);

  // Metrics calculation
  const totalValue = filteredClients.reduce((acc, c) => acc + (Number(c.valor_buscado) || 0), 0);
  const conversionRate = (clients.filter(c => c.status === 'Fechado').length / (clients.length || 1) * 100).toFixed(1);
  const avgTime = 14; 
  const stalledLeads = filteredClients.filter(c => {
    if (!c.updated_at) return false;
    const lastUpdate = new Date(c.updated_at);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    return lastUpdate < thirtyDaysAgo;
  });

  const comparisonData = [
    { name: 'Jan', atual: 4000, anterior: 2400 },
    { name: 'Fev', atual: 3000, anterior: 1398 },
    { name: 'Mar', atual: 2000, anterior: 9800 },
    { name: 'Abr', atual: 2780, anterior: 3908 },
  ];

  const handleDragStart = (event: any) => {
    const { active } = event;
    const client = filteredClients.find(c => c.id === active.id);
    setActiveClient(client);
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    setActiveClient(null);

    if (!over) return;

    const clientId = active.id;
    const overId = over.id;

    // Check if over is a stage id or a client id
    let newStatus = overId;
    if (!stages.find(s => s.id === overId)) {
      const overClient = filteredClients.find(c => c.id === overId);
      if (overClient) newStatus = overClient.status;
    }

    if (stages.find(s => s.id === newStatus)) {
      const client = filteredClients.find(c => c.id === clientId);
      if (client && client.status !== newStatus) {
        updateClientStatus(clientId, newStatus);
      }
    }
  };

  const addStage = () => {
    const name = window.prompt('Nome da nova etapa:');
    if (name) {
      setStages([...stages, { 
        id: name, 
        label: name, 
        color: 'bg-slate-400' 
      }]);
    }
  };

  return (
    <DndContext 
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        {/* Header & Controls */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-3xl font-black text-slate-900 tracking-tight">Funil Avançado</h3>
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-[0.6rem] font-bold uppercase rounded-full tracking-widest">Premium</span>
            </div>
            <p className="text-[#003366] text-xs font-bold uppercase tracking-widest">Gestão de Performance e Conversão</p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <div className="flex bg-slate-100 p-1 rounded-xl">
              <button 
                onClick={() => setFunnelView('kanban')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${funnelView === 'kanban' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                <Kanban className="w-4 h-4" /> Kanban
              </button>
              <button 
                onClick={() => setFunnelView('analytics')}
                className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${funnelView === 'analytics' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                <BarChart3 className="w-4 h-4" /> Insights
              </button>
            </div>

            <div className="relative group">
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="appearance-none bg-white border border-slate-200 px-10 py-2.5 rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none cursor-pointer"
              >
                <option value="all">Filtro: Todos Imóveis</option>
                <option value="Casa">Casas</option>
                <option value="Apartamento">Apartamentos</option>
                <option value="Terreno">Terrenos</option>
              </select>
              <Filter className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>
        </div>

        {funnelView === 'analytics' ? (
          <div className="space-y-8">
            {/* Analytics View */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Taxa de Conversão</p>
                <h4 className="text-2xl font-black text-slate-900">{conversionRate}%</h4>
                <p className="text-[0.65rem] text-emerald-500 font-bold mt-2">↑ 2.4% vs mês anterior</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest mb-1">VGV em Negociação</p>
                <h4 className="text-2xl font-black text-slate-900">R$ {(totalValue / 1000000).toFixed(2)}M</h4>
                <p className="text-[0.65rem] text-blue-500 font-bold mt-2">18 oportunidades ativas</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Tempo Médio p/ Fechar</p>
                <h4 className="text-2xl font-black text-slate-900">{avgTime} dias</h4>
                <p className="text-[0.65rem] text-amber-500 font-bold mt-2">Ciclo de venda médio</p>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Previsão de Fechamento</p>
                <h4 className="text-2xl font-black text-emerald-600">R$ {(totalValue * 0.15 / 1000000).toFixed(2)}M</h4>
                <p className="text-[0.65rem] text-slate-400 font-bold mt-2">Probabilidade ponderada (15%)</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-8">Conversão Mês a Mês</h3>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={comparisonData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                      />
                      <Bar dataKey="atual" name="Este Mês" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                      <Bar dataKey="anterior" name="Mês Anterior" fill="#cbd5e1" radius={[4, 4, 0, 0]} barSize={20} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-8">Performance do Funil</h3>
                <div className="space-y-6">
                  {stages.map((s, i) => {
                    const count = filteredClients.filter(c => c.status === s.id).length;
                    const percentage = (count / (filteredClients.length || 1) * 100);
                    return (
                      <div key={s.id} className="space-y-2">
                        <div className="flex justify-between items-center text-xs font-bold">
                          <span className="text-slate-600 uppercase tracking-widest">{s.label}</span>
                          <span className="text-slate-900">{count} leads</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ delay: i * 0.1, duration: 1 }}
                            className={`h-full ${s.color}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-6 min-w-full items-start pb-10 overflow-x-auto no-scrollbar scroll-smooth">
            {stages.map((stage) => {
              const stageClients = filteredClients.filter(c => c.status === stage.id);
              
              return (
                <div key={stage.id} className="flex flex-col gap-6 min-w-[300px] max-w-[300px]">
                  <div className="flex justify-between items-center px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                      <span className="text-[0.7rem] font-black uppercase tracking-[0.1em] text-slate-900">{stage.label}</span>
                    </div>
                    <span className="text-[0.65rem] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">
                      {stageClients.length}
                    </span>
                  </div>
                  
                  <SortableContext 
                    id={stage.id}
                    items={stageClients.map(c => c.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div 
                      className="space-y-4 min-h-[600px] p-2 rounded-3xl bg-slate-100/30 border-2 border-dashed border-slate-200/50 transition-colors"
                    >
                      {stageClients.map((client) => {
                        const isStalled = stalledLeads.some(s => s.id === client.id);
                        const isClosingSoon = client.status === 'Negociação';

                        return (
                          <DraggableCard 
                            key={client.id}
                            client={client}
                            onClientClick={onClientClick}
                            isStalled={isStalled}
                            isClosingSoon={isClosingSoon}
                            onSchedule={onSchedule}
                            onFollowUp={() => {
                              const phone = cleanPhoneNumberForWhatsApp(client.telefone || '');
                              if (phone) window.open(`https://wa.me/${phone}`, '_blank');
                            }}
                          />
                        );
                      })}
                    </div>
                  </SortableContext>
                </div>
              );
            })}
            
            <button 
              onClick={addStage}
              className="min-w-[300px] h-[700px] rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/30 transition-all group"
            >
              <Plus className="w-8 h-8 mb-4 group-hover:scale-110 transition-transform" />
              <p className="text-xs font-bold uppercase tracking-widest">Nova Etapa</p>
            </button>
          </div>
        )}

        <DragOverlay>
          {activeClient ? (
            <div className="w-[280px]">
              <div className="bg-white rounded-2xl p-4 shadow-2xl border-2 border-blue-400 opacity-90">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
                    <User className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-slate-900 text-sm truncate">{activeClient.nome}</h4>
                    <p className="text-[0.6rem] text-slate-400 font-medium truncate">{activeClient.tipo}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </motion.div>
    </DndContext>
  );
}

function ClientDetail({ clientId, onBack, onEdit, onDelete, onRefresh }: { clientId: string, onBack: () => void, onEdit: (client: any) => void, onDelete: () => void, onRefresh: () => void }) {
  const [client, setClient] = useState<any>(null);
  const [newInteraction, setNewInteraction] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);

  useEffect(() => {
    const fetchClient = async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', clientId)
        .single();
      
      if (!error && data) {
        setClient(getCleanClient(data));
      }
    };

    fetchClient();

    const channel = supabase
      .channel(`client_${clientId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `id=eq.${clientId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          onDelete();
        } else {
          setClient(getCleanClient(payload.new));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, onDelete]);

  const handleAddInteraction = async () => {
    if (!newInteraction.trim() || !client || isAddingInteraction) return;
    
    setIsAddingInteraction(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const newHistory = [
        ...(client.historico_conversas || []),
        {
          type: 'WhatsApp',
          notes: newInteraction,
          date: new Date().toISOString(),
          corretorId: user.id
        }
      ];

      const { error } = await supabase
        .from('clients')
        .update({ historico_conversas: newHistory })
        .eq('id', clientId);
      
      if (!error) {
        setNewInteraction('');
        setClient((prev: any) => ({ ...prev, historico_conversas: newHistory }));
        onRefresh();
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsAddingInteraction(false);
    }
  };

  const handleDeleteInteraction = async (index: number) => {
    if (!client) return;
    
    const originalHistory = [...(client.historico_conversas || [])];
    // Since we display reversed, the index passed is from the reversed array
    const originalIndex = originalHistory.length - 1 - index;
    const newHistory = originalHistory.filter((_, i) => i !== originalIndex);

    try {
      const { error } = await supabase
        .from('clients')
        .update({ historico_conversas: newHistory })
        .eq('id', clientId);
      
      if (!error) {
        setClient((prev: any) => ({ ...prev, historico_conversas: newHistory }));
        onRefresh();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async () => {
    if (!client || isDeleting) return;
    
    setIsDeleting(true);
    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      
      if (error) {
        console.error("Delete error:", error);
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      } else {
        onDelete();
        onRefresh();
      }
    } catch (error: any) {
      console.error("Unexpected delete error:", error);
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!client) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="max-w-7xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm gap-6 md:gap-0">
        <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6 w-full">
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={onBack} className="p-2.5 md:p-3 bg-slate-50 text-slate-600 hover:text-slate-900 rounded-2xl transition-all flex-shrink-0">
              <Plus className="w-4 h-4 md:w-5 md:h-5 rotate-45" />
            </button>
            {getClientPhoto(client) ? (
              <img 
                src={getClientPhoto(client)!} 
                alt={client.nome} 
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[1.5rem] object-cover border-2 border-slate-50 shadow-sm flex-shrink-0" 
              />
            ) : (
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 shadow-sm flex-shrink-0">
                <User className="w-8 h-8 md:w-10 md:h-10" />
              </div>
            )}
            <div className="md:hidden">
              <span className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest">#{client.id.substring(0, 8)}</span>
              <h2 className="text-xl font-black text-slate-900 leading-tight truncate">{client.nome}</h2>
            </div>
          </div>
          
          <div className="w-full">
            <div className="hidden md:flex items-center gap-2 mb-1">
              <span className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest">Lead ID: #{client.id.substring(0, 8)}</span>
            </div>
            <h2 className="hidden md:block text-3xl font-black text-slate-900 tracking-tight">
              {client.nome}
              {client.aniversario && (
                <span className="ml-3 text-xl font-bold text-[#003366]">
                  ({calculateAge(client.aniversario)} anos)
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-3 md:gap-6 mt-2 md:mt-6">
              <div className="flex flex-col flex-1 min-w-[100px] md:min-w-0">
                <p className="text-[0.6rem] md:text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1 md:mb-2">Venda / Locação</p>
                <div className="px-3 md:px-6 py-2 md:py-3 bg-white border border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-900 shadow-sm text-center">
                  {client.v_l || 'Venda'}
                </div>
              </div>
              <div className="flex flex-col flex-1 min-w-[100px] md:min-w-0">
                <p className="text-[0.6rem] md:text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1 md:mb-2">Status Lead</p>
                <div className={`px-4 md:px-10 py-2 md:py-3 rounded-xl md:rounded-2xl text-xs md:text-base font-black shadow-lg ${
                  client.status === 'Fechado' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                  client.status === 'Visita' ? 'bg-blue-600 text-white shadow-blue-200' :
                  client.status === 'Negociação' ? 'bg-amber-500 text-white shadow-amber-200' :
                  'bg-slate-100 text-[#003366]'
                } text-center`}>
                  {client.status}
                </div>
              </div>
              <div className="flex flex-col flex-1 min-w-[100px] md:min-w-0">
                <p className="text-[0.6rem] md:text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1 md:mb-2">Forma de Compra</p>
                <div className="px-3 md:px-6 py-2 md:py-3 bg-white border border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-900 shadow-sm text-center">
                  {client.forma_compra || 'Não inf.'}
                </div>
              </div>
              <div className="flex flex-col flex-1 min-w-[100px] md:min-w-0">
                <p className="text-[0.6rem] md:text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1 md:mb-2 text-nowrap">Budget</p>
                <div className="px-3 md:px-6 py-2 md:py-3 bg-white border border-slate-100 rounded-xl md:rounded-2xl text-xs md:text-sm font-bold text-slate-900 shadow-sm text-center">
                  R$ {client.valor_buscado?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-2 md:gap-4 w-full md:w-auto">
          <button 
            onClick={() => onEdit(client)}
            className="flex-1 md:flex-none px-4 md:px-8 py-3 bg-slate-900 text-white rounded-xl md:rounded-2xl font-bold shadow-lg shadow-slate-900/20 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 text-sm"
          >
            <FileText className="w-4 h-4" />
            Editar
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl md:rounded-2xl transition-all"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Left Column: Client Info */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
          {/* Contact & Personal Info */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50">
              <h3 className="text-lg font-bold text-slate-900">Informações de Contato</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-50">
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div className="overflow-hidden">
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">E-mail Principal</p>
                    <p className="text-sm font-bold text-slate-900 truncate">{client.email || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">WhatsApp / Telefone</p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-bold text-slate-900">{[client.whatsapp, client.telefone].filter(Boolean).join(' / ') || 'Não informado'}</p>
                      {(client.whatsapp || client.telefone) && (
                        <a 
                          href={`https://wa.me/${cleanPhoneNumberForWhatsApp(client.whatsapp || client.telefone)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2"
                        >
                          <MessageCircle className="w-4 h-4 fill-current" />
                          <span className="text-[0.65rem] font-bold uppercase">WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Rede Social</p>
                    <p className="text-sm font-bold text-slate-900">{client.rede_social || 'Não informado'}</p>
                  </div>
                </div>
              </div>
              <div className="p-6 md:p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Data de Nascimento</p>
                    <p className="text-sm font-bold text-slate-900">
                      {client.aniversario ? format(new Date(client.aniversario), 'dd/MM/yyyy') : 'Não informado'}
                      {client.aniversario && <span className="ml-2 text-[#003366] font-bold">({calculateAge(client.aniversario)} anos)</span>}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-slate-50 rounded-xl text-slate-600">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Documento (CPF/RG)</p>
                    <p className="text-sm font-bold text-slate-900">{client.documento || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-purple-50 rounded-xl text-purple-600">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Profissão / Cargo</p>
                    <p className="text-sm font-bold text-slate-900">{client.profissao || 'Não informado'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Property Preferences */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-50 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">Perfil de Busca</h3>
              <span className="px-4 py-1.5 bg-blue-600 text-white text-[0.65rem] font-bold uppercase tracking-widest rounded-full shadow-lg shadow-blue-200">
                {client.v_l || 'Venda'}
              </span>
            </div>
            <div className="p-8 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Budget Máximo</p>
                <p className="text-xl font-black text-slate-900">R$ {client.valor_buscado?.toLocaleString() || '0'}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Venda / Locação</p>
                <p className="text-xl font-black text-slate-900">{client.v_l || 'Venda'}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Forma de Compra</p>
                <div className="flex items-center gap-2">
                   <div className="p-1.5 bg-white rounded-lg shadow-sm">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                   </div>
                   <p className="text-sm font-bold text-slate-900">{client.forma_compra || 'Não inf.'}</p>
                </div>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Código Imóvel</p>
                <p className="text-xl font-black text-slate-900">{client.codigo || 'N/A'}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Área Desejada</p>
                <p className="text-xl font-black text-slate-900">{client.metragem_quadrada || '0'} m²</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Andar</p>
                <p className="text-xl font-black text-slate-900">{client.andar || '0'}º</p>
              </div>
            </div>
            <div className="px-8 pb-8 grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Dormitórios</p>
                <p className="text-xl font-black text-slate-900">{client.dormitorios || '0'}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Suítes</p>
                <p className="text-xl font-black text-slate-900">{client.suites || '0'}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Banheiros</p>
                <p className="text-xl font-black text-slate-900">{client.banheiros || '0'}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Vagas</p>
                <p className="text-xl font-black text-slate-900">{client.vagas || '0'}</p>
              </div>
            </div>
            <div className="px-8 pb-8 grid grid-cols-2 gap-8">
              <div>
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-3">Locais de Interesse</p>
                <div className="flex flex-wrap gap-2">
                  {client.bairros?.map((b: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-white text-[#003366] text-[0.65rem] font-bold rounded-lg border border-slate-200">
                      {b}
                    </span>
                  )) || <span className="text-xs text-[#003366] font-bold italic">Nenhum local selecionado</span>}
                </div>
              </div>
              <div>
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-3">Tipo de Imóvel</p>
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                    <MapPin className="w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-slate-900">{client.tipo || 'Não especificado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback & Property Sent */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Imóveis Enviados</h3>
              <p className="text-sm font-bold text-slate-900 bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[100px]">
                {client.imovel_enviado || 'Nenhum imóvel enviado ainda.'}
              </p>
            </div>
            <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Feedback do Cliente</h3>
              <p className="text-sm font-bold text-slate-900 bg-slate-50 p-4 rounded-2xl border border-slate-100 min-h-[100px]">
                {client.feedback || 'Nenhum feedback registrado.'}
              </p>
            </div>
          </div>

          {/* Notas do Corretor */}
          <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-900">Notas do Corretor</h3>
              <div className="flex items-center gap-2 text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest">
                <Clock className="w-3 h-3" />
                Última Atualização: {client.updated_at ? format(new Date(client.updated_at), 'dd/MM/yyyy HH:mm') : 'N/A'}
              </div>
            </div>
            <div className="p-6 bg-amber-100 rounded-2xl border border-amber-200 text-sm font-bold text-[#003366] leading-relaxed italic">
              {client.outros ? getCleanOthers(client.outros) : 'Nenhuma nota registrada para este lead.'}
            </div>
          </div>
        </div>

        {/* Right Column: Interaction History */}
        <div className="col-span-12 lg:col-span-4 space-y-8">
          <div className="bg-amber-100 p-6 md:p-8 rounded-3xl border border-amber-200 shadow-sm flex flex-col h-[500px] md:h-[800px]">
            <div className="flex justify-between items-center mb-8">
              <h3 className="text-lg font-bold text-slate-900">Histórico de Conversa</h3>
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
                <MessageCircle className="w-4 h-4" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-8 pr-2 custom-scrollbar">
              {client.historico_conversas?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-4 border border-amber-200">
                    <Clock className="w-8 h-8 text-amber-400" />
                  </div>
                  <p className="text-xs text-[#003366] font-bold italic">Nenhuma interação registrada.</p>
                </div>
              ) : (
                [...(client.historico_conversas || [])].reverse().map((int: any, i: number) => (
                  <div key={i} className="relative pl-8 before:absolute before:left-0 before:top-2 before:bottom-0 before:w-0.5 before:bg-amber-200 last:before:hidden group">
                    <div className="absolute left-[-4px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-4 border-white shadow-sm"></div>
                    <div className="flex justify-between items-center mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[0.6rem] font-bold text-blue-600 uppercase tracking-widest">{int.type || 'WhatsApp'}</span>
                        <button 
                          onClick={() => handleDeleteInteraction(i)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600 transition-all"
                          title="Excluir mensagem"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      <span className="text-[0.6rem] text-[#003366] font-extrabold">{format(new Date(int.date), 'dd MMM, HH:mm')}</span>
                    </div>
                    <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-sm">
                      <p className="text-xs text-slate-900 font-medium leading-relaxed">{int.notes}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-8 pt-8 border-t border-amber-200">
              <div className="relative">
                <textarea 
                  value={newInteraction}
                  onChange={(e) => setNewInteraction(e.target.value)}
                  placeholder="Registrar nova interação..."
                  className="w-full bg-white border-2 border-blue-100 rounded-2xl py-4 pl-4 pr-12 text-xs focus:ring-4 focus:ring-blue-50 focus:border-blue-200 outline-none transition-all min-h-[100px] resize-none shadow-sm"
                />
                <button 
                  onClick={handleAddInteraction}
                  disabled={isAddingInteraction || !newInteraction.trim()}
                  className="absolute right-3 bottom-3 p-3 bg-blue-600 text-white rounded-xl shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all disabled:opacity-50"
                >
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md p-10 text-center"
            >
              <div className="w-24 h-24 bg-red-50 rounded-3xl flex items-center justify-center mx-auto mb-8">
                <AlertCircle className="w-12 h-12 text-red-600" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">Confirmar Exclusão</h3>
              <p className="text-slate-500 text-sm leading-relaxed mb-10">
                Tem certeza que deseja excluir o cadastro de <span className="font-bold text-slate-900">{client.nome}</span>? 
                Esta ação é permanente e não pode ser desfeita.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="py-4 bg-red-600 text-white rounded-2xl font-bold hover:bg-red-700 transition-all shadow-xl shadow-red-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDeleting ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                  ) : 'Sim, Excluir'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SettingsView({ profile }: { profile: any }) {
  const [name, setName] = useState(profile?.name || '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photo_url || '');
  const [loading, setLoading] = useState(false);
  const { user, refreshProfile } = useSupabase();

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const onCropComplete = (croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => setImageToCrop(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = async () => {
    if (imageToCrop && croppedAreaPixels) {
      const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
      setPhotoUrl(croppedImage);
      setImageToCrop(null);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          name, 
          photo_url: photoUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);
      
      if (error) throw error;
      alert("Perfil atualizado com sucesso!");
      await refreshProfile();
    } catch (err: any) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-2xl space-y-8"
    >
      <h3 className="text-4xl font-bold text-blue-900 tracking-tight">Configurações do Corretor</h3>
      
      <div className="bg-white p-8 rounded-2xl shadow-sm space-y-6">
        <div className="flex items-center gap-6">
          <div className="relative group">
            {photoUrl ? (
              <img 
                src={photoUrl} 
                alt="" 
                className="w-24 h-24 rounded-full object-cover border-4 border-blue-50 transition-all group-hover:opacity-75" 
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border-4 border-white shadow-xl">
                <User className="w-12 h-12" />
              </div>
            )}
            <label className="absolute inset-0 flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-all">
              <Camera className="w-8 h-8 text-white drop-shadow-md" />
              <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
            </label>
          </div>
          <div>
            <h4 className="text-2xl font-bold text-blue-900">{profile?.name}</h4>
            <p className="text-on-surface-variant">{profile?.email}</p>
            <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-bold uppercase tracking-widest">
              {profile?.role}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 pt-6 border-t border-slate-100">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Nome Completo</label>
            <input 
              type="text" 
              value={name} 
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-900/20 outline-none transition-all" 
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">E-mail</label>
            <input type="email" value={profile?.email} disabled className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 opacity-50 cursor-not-allowed" />
          </div>
        </div>

        <button 
          onClick={handleSave}
          disabled={loading}
          className="px-8 py-3 bg-blue-900 text-white rounded-xl font-bold shadow-lg shadow-blue-900/20 hover:bg-blue-800 transition-all disabled:opacity-50"
        >
          {loading ? 'Salvando...' : 'Salvar Alterações'}
        </button>

        <div className="pt-8 border-t border-slate-100">
          <button 
            onClick={() => supabase.auth.signOut()}
            className="flex items-center gap-2 text-red-600 font-bold hover:text-red-700 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair da Conta
          </button>
        </div>
      </div>

      {/* Modal de Corte de Imagem */}
      <AnimatePresence>
        {imageToCrop && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-blue-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-xl font-bold text-blue-900">Ajustar Foto de Perfil</h3>
                <button onClick={() => setImageToCrop(null)} className="text-slate-400 hover:text-slate-600">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="relative h-80 bg-slate-900">
                <Cropper
                  image={imageToCrop}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  onCropChange={setCrop}
                  onCropComplete={onCropComplete}
                  onZoomChange={setZoom}
                />
              </div>
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-4">
                  <span className="text-xs font-bold text-slate-500 uppercase">Zoom</span>
                  <input
                    type="range"
                    value={zoom}
                    min={1}
                    max={3}
                    step={0.1}
                    aria-labelledby="Zoom"
                    onChange={(e: any) => setZoom(e.target.value)}
                    className="flex-1"
                  />
                </div>
                <button 
                  onClick={handleCropSave}
                  className="w-full py-3 bg-blue-900 text-white rounded-xl font-bold hover:bg-blue-800 transition-all"
                >
                  Confirmar Foto
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function LeadModal({ isOpen, onClose, initialData, onSuccess }: { isOpen: boolean, onClose: () => void, initialData?: any, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    entryDate: format(new Date(), 'yyyy-MM-dd'),
    phone: '',
    email: '',
    whatsapp: '',
    socialMedia: '',
    birthday: '',
    document: '',
    profession: '',
    vl: 'Venda',
    code: '',
    valueSought: '',
    status: 'Novo',
    neighborhood1: '',
    neighborhood2: '',
    neighborhood3: '',
    propertyType: '',
    squareFootage: '',
    floor: '',
    bedrooms: '',
    suites: '',
    bathrooms: '',
    parkingSpaces: '',
    others: '',
    propertySent: '',
    formaCompra: '',
    feedback: '',
    observations: '',
    contact: '',
    photoUrl: ''
  });

  useEffect(() => {
    if (isOpen) {
      const cleanData = getCleanClient(initialData);
      if (cleanData) {
        setFormData({
          name: cleanData.nome || '',
          entryDate: cleanData.data_entrada || format(new Date(), 'yyyy-MM-dd'),
          phone: cleanData.telefone || '',
          email: cleanData.email || '',
          whatsapp: cleanData.whatsapp || '',
          socialMedia: cleanData.rede_social || '',
          birthday: cleanData.aniversario || '',
          document: cleanData.documento || '',
          profession: cleanData.profissao || '',
          vl: cleanData.v_l || 'Venda',
          code: cleanData.codigo || '',
          valueSought: cleanData.valor_buscado?.toString() || '',
          status: cleanData.status || 'Novo',
          neighborhood1: cleanData.bairros?.[0] || '',
          neighborhood2: cleanData.bairros?.[1] || '',
          neighborhood3: cleanData.bairros?.[2] || '',
          propertyType: cleanData.tipo || '',
          squareFootage: cleanData.metragem_quadrada?.toString() || '',
          floor: cleanData.andar?.toString() || '',
          bedrooms: cleanData.dormitorios?.toString() || '',
          suites: cleanData.suites?.toString() || '',
          bathrooms: cleanData.banheiros?.toString() || '',
          parkingSpaces: cleanData.vagas?.toString() || '',
          others: cleanData.outros || '',
          propertySent: cleanData.imovel_enviado || '',
          formaCompra: cleanData.forma_compra || '',
          feedback: cleanData.feedback || '',
          observations: cleanData.observacoes || '',
          contact: cleanData.contato || '',
          photoUrl: cleanData.foto_url || ''
        });
      } else {
        setFormData({
          name: '',
          entryDate: format(new Date(), 'yyyy-MM-dd'),
          phone: '',
          email: '',
          whatsapp: '',
          socialMedia: '',
          birthday: '',
          document: '',
          profession: '',
          vl: 'Venda',
          code: '',
          valueSought: '',
          status: 'Novo',
          neighborhood1: '',
          neighborhood2: '',
          neighborhood3: '',
          propertyType: '',
          squareFootage: '',
          floor: '',
          bedrooms: '',
          suites: '',
          bathrooms: '',
          parkingSpaces: '',
          others: '',
          propertySent: '',
          formaCompra: '',
          feedback: '',
          observations: '',
          contact: '',
          photoUrl: ''
        });
      }
    }
  }, [initialData, isOpen]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const onCropComplete = (_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  };

  const handleConfirmCrop = async () => {
    if (imageToCrop && croppedAreaPixels) {
      try {
        const croppedImage = await getCroppedImg(imageToCrop, croppedAreaPixels);
        setFormData(prev => ({ ...prev, photoUrl: croppedImage }));
        setImageToCrop(null);
      } catch (e) {
        console.error(e);
      }
    }
  };

  const parseNumeric = (val: string) => {
    if (!val) return 0;
    // Remove dots (thousands separator) and replace comma with dot (decimal separator)
    const cleanVal = val.replace(/\./g, '').replace(',', '.');
    const num = Number(cleanVal);
    return isNaN(num) ? 0 : num;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!formData.name.trim()) {
      setError("O nome é obrigatório.");
      return;
    }

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) {
        setError("Sessão expirada. Por favor, faça login novamente.");
        return;
      }
      
      setLoading(true);
      const payload: any = {
        user_id: user.id,
        nome: formData.name,
        telefone: formData.phone,
        email: formData.email,
        whatsapp: formData.whatsapp,
        rede_social: formData.socialMedia,
        documento: formData.document,
        profissao: formData.profession,
        v_l: formData.vl,
        codigo: formData.code,
        valor_buscado: parseNumeric(formData.valueSought),
        status: formData.status,
        bairros: [formData.neighborhood1, formData.neighborhood2, formData.neighborhood3].filter(Boolean),
        tipo: formData.propertyType,
        metragem_quadrada: parseNumeric(formData.squareFootage),
        andar: Math.floor(parseNumeric(formData.floor)),
        dormitorios: Math.floor(parseNumeric(formData.bedrooms)),
        suites: Math.floor(parseNumeric(formData.suites)),
        banheiros: Math.floor(parseNumeric(formData.bathrooms)),
        vagas: Math.floor(parseNumeric(formData.parkingSpaces)),
        outros: formData.others,
        imovel_enviado: formData.propertySent,
        forma_compra: formData.formaCompra,
        feedback: formData.feedback,
        observacoes: formData.observations,
        contato: formData.contact,
        foto_url: formData.photoUrl,
      };

      if (formData.entryDate) payload.data_entrada = formData.entryDate;
      if (formData.birthday) payload.aniversario = formData.birthday;
      
      console.log("Saving client payload:", JSON.stringify(payload, null, 2));

      let error;
      if (initialData) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', initialData.id);
        error = updateError;
      } else {
        payload.historico_conversas = [];
        const { error: insertError } = await supabase
          .from('clients')
          .insert([payload]);
        error = insertError;
      }

      if (error) {
        console.error("Supabase Error Details:", JSON.stringify(error, null, 2));
        setError(`Erro no banco de dados: ${error.message || JSON.stringify(error)}`);
        throw error;
      }
      
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error saving lead:", error);
      const errorMessage = error.message || (typeof error === 'object' ? JSON.stringify(error) : String(error));
      setError(`Erro ao salvar: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-6 md:p-10 border-b border-slate-50 flex justify-between items-center bg-white">
          <div className="max-w-[80%]">
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-[0.6rem] md:text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Gestão de Leads</span>
            </div>
            <h3 className="text-xl md:text-3xl font-black text-slate-900 tracking-tight truncate">
              {initialData ? 'Editar Cadastro' : 'Novo Lead Executivo'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-3 md:p-4 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all flex-shrink-0"
          >
            <Plus className="w-5 h-5 md:w-6 md:h-6 rotate-45" />
          </button>
        </div>

        {/* Modal de Recorte de Foto */}
        <AnimatePresence>
          {imageToCrop && (
            <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
              >
                <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Ajustar Foto de Perfil</h3>
                  <button onClick={() => setImageToCrop(null)} className="p-2 bg-slate-50 text-slate-400 rounded-xl">
                    <Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
                
                <div className="relative h-[400px] bg-slate-900">
                  <Cropper
                    image={imageToCrop}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                    cropShape="round"
                    showGrid={false}
                  />
                </div>

                <div className="p-10 space-y-8">
                  <div className="space-y-4">
                    <div className="flex justify-between text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Zoom da Imagem</span>
                      <span className="text-blue-600">{Math.round(zoom * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      value={zoom}
                      min={1}
                      max={3}
                      step={0.1}
                      aria-labelledby="Zoom"
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      type="button"
                      onClick={() => setImageToCrop(null)}
                      className="py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="button"
                      onClick={handleConfirmCrop}
                      className="py-4 bg-slate-900 text-white rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-xl shadow-slate-900/20"
                    >
                      Salvar Foto
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
          {error && (
            <div className="mx-6 md:mx-10 mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="p-6 md:p-10 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            {/* Coluna 1: Perfil & Contato */}
            <div className="space-y-6 md:space-y-8">
              <div className="flex flex-col items-center mb-6 md:mb-10">
                <div className="relative group">
                  <div className="w-32 h-32 rounded-[2.5rem] bg-slate-50 border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden transition-all group-hover:border-blue-400">
                    {formData.photoUrl ? (
                      <img src={formData.photoUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-10 h-10 text-slate-300" />
                    )}
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handlePhotoUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    />
                    <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <p className="text-[0.6rem] font-bold text-white uppercase tracking-widest">Alterar</p>
                    </div>
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200 border-4 border-white">
                    <Plus className="w-5 h-5" />
                  </div>
                </div>
                <p className="mt-4 text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest">Foto do Perfil</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Nome Completo *</label>
                  <input required type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-400" placeholder="Ex: João Silva" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">WhatsApp</label>
                    <input type="tel" value={formData.whatsapp} onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-400" placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Telefone</label>
                    <input type="tel" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-400" placeholder="(00) 0000-0000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">E-mail Principal</label>
                  <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-400" placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Rede Social</label>
                  <input type="text" value={formData.socialMedia} onChange={(e) => setFormData({ ...formData, socialMedia: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-400" placeholder="@usuario" />
                </div>
                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Profissão / Cargo</label>
                  <input type="text" value={formData.profession} onChange={(e) => setFormData({ ...formData, profession: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all placeholder:text-slate-400" placeholder="Ex: Diretor Executivo" />
                </div>
              </div>
            </div>

            {/* Coluna 2: Preferências & Imóvel */}
            <div className="space-y-6 md:space-y-8">
              <div className="p-6 md:p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                  Perfil de Busca
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Venda / Locação</label>
                    <select value={formData.vl} onChange={(e) => setFormData({ ...formData, vl: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none">
                      <option value="Venda">Venda</option>
                      <option value="Locação">Locação</option>
                      <option value="Ambos">Ambos</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Status Lead</label>
                    <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none">
                      <option value="Novo">Novo</option>
                      <option value="Ativo">Ativo</option>
                      <option value="Visita">Visita</option>
                      <option value="Negociação">Negociação</option>
                      <option value="Fechado">Fechado</option>
                      <option value="Parado">Parado</option>
                      <option value="Perdido">Perdido</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Budget Máximo (R$)</label>
                    <input type="text" value={formData.valueSought} onChange={(e) => setFormData({ ...formData, valueSought: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0,00" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Código do Imóvel</label>
                    <input type="text" value={formData.code} onChange={(e) => setFormData({ ...formData, code: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Ex: IMOB123" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Forma de compra</label>
                  <select value={formData.formaCompra} onChange={(e) => setFormData({ ...formData, formaCompra: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none">
                    <option value="">Selecione a forma</option>
                    <option value="A vista">À vista</option>
                    <option value="Financiamento">Financiamento</option>
                    <option value="Permuta">Permuta</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Tipo de Imóvel</label>
                  <select value={formData.propertyType} onChange={(e) => setFormData({ ...formData, propertyType: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none">
                    <option value="">Selecione o tipo</option>
                    <option value="Apartamento">Apartamento</option>
                    <option value="Estudio">Estudio</option>
                    <option value="Cobertura">Cobertura</option>
                    <option value="Cond. Fechado">Cond. Fechado</option>
                    <option value="Casa térrea">Casa térrea</option>
                    <option value="Sobrado">Sobrado</option>
                    <option value="Casa Vila">Casa Vila</option>
                    <option value="Casa Condomínio">Casa Condomínio</option>
                    <option value="Galpão">Galpão</option>
                    <option value="Loja">Loja</option>
                    <option value="Prédio Comercial">Prédio Comercial</option>
                    <option value="Sala Comercial">Sala Comercial</option>
                    <option value="Terreno">Terreno</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Área Mínima (m²)</label>
                    <input type="text" value={formData.squareFootage} onChange={(e) => setFormData({ ...formData, squareFootage: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Andar</label>
                    <input type="text" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0" />
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Dormitórios</label>
                      <input type="text" value={formData.bedrooms} onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Suítes</label>
                      <input type="text" value={formData.suites} onChange={(e) => setFormData({ ...formData, suites: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Banheiros</label>
                      <input type="text" value={formData.bathrooms} onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Vagas de Garagem</label>
                      <input type="text" value={formData.parkingSpaces} onChange={(e) => setFormData({ ...formData, parkingSpaces: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="0" />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Locais de Interesse</label>
                  <div className="space-y-2">
                    <input type="text" value={formData.neighborhood1} onChange={(e) => setFormData({ ...formData, neighborhood1: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-5 text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Local Principal" />
                    <input type="text" value={formData.neighborhood2} onChange={(e) => setFormData({ ...formData, neighborhood2: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-5 text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Local Secundário" />
                    <input type="text" value={formData.neighborhood3} onChange={(e) => setFormData({ ...formData, neighborhood3: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-5 text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Local Terciário" />
                  </div>
                </div>
              </div>
            </div>

            {/* Coluna 3: Notas & Datas */}
            <div className="space-y-8">
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Data Entrada</label>
                    <input type="date" value={formData.entryDate} onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Aniversário</label>
                    <input type="date" value={formData.birthday} onChange={(e) => setFormData({ ...formData, birthday: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Documento (CPF/RG)</label>
                  <input type="text" value={formData.document} onChange={(e) => setFormData({ ...formData, document: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="000.000.000-00" />
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Imóveis Enviados</label>
                  <input type="text" value={formData.propertySent} onChange={(e) => setFormData({ ...formData, propertySent: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Códigos dos imóveis enviados..." />
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Feedback</label>
                  <input type="text" value={formData.feedback} onChange={(e) => setFormData({ ...formData, feedback: e.target.value })} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Feedback do cliente..." />
                </div>

                <div className="space-y-2">
                  <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Notas do Corretor</label>
                  <textarea 
                    value={formData.others} 
                    onChange={(e) => setFormData({ ...formData, others: e.target.value })} 
                    className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all min-h-[150px] resize-none" 
                    placeholder="Observações importantes sobre o perfil do cliente..."
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-10 bg-slate-50 border-t border-slate-100 flex justify-end gap-4">
            <button 
              type="button"
              onClick={onClose}
              className="px-10 py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
            >
              Descartar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-12 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-xl shadow-slate-900/20 flex items-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>
                  <FileText className="w-5 h-5" />
                  {initialData ? 'Salvar Alterações' : 'Finalizar Cadastro'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

function CalendarView({ appointments, onEdit, onAdd }: { 
  appointments: any[], 
  onEdit: (appointment: any) => void,
  onAdd: () => void
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const getDayAppointments = (day: Date) => {
    return appointments.filter(app => isSameDay(parseISO(app.start_time), day));
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h3 className="text-3xl font-black text-slate-900 capitalize leading-none">
              {format(currentDate, 'MMMM', { locale: ptBR })}
            </h3>
            <span className="text-sm font-bold text-blue-600 uppercase tracking-widest mt-1">
              {format(currentDate, 'yyyy')}
            </span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePrevMonth}
              className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={handleNextMonth}
              className="p-3 bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {}} 
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-500 rounded-2xl border border-slate-100 text-xs font-bold hover:bg-slate-100 transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar
          </button>
          <button 
            onClick={onAdd}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
          >
            <Plus className="w-5 h-5" />
            Agendar Atividade
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-50">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-4 text-center text-[0.6rem] font-black text-slate-300 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayApps = getDayAppointments(day);
            const isTodayDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, monthStart);

            return (
              <div 
                key={idx} 
                className={`min-h-[140px] p-2 border-r border-b border-slate-50 last:border-r-0 relative transition-all hover:bg-slate-50 cursor-pointer group ${!isCurrentMonth ? 'bg-slate-50/30' : ''}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                    isTodayDay 
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' 
                      : isCurrentMonth ? 'text-slate-900' : 'text-slate-200'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1.5 overflow-hidden">
                  {dayApps.map(app => (
                    <button
                      key={app.id}
                      onClick={(e) => { e.stopPropagation(); onEdit(app); }}
                      className={`w-full text-left p-2 rounded-xl border transition-all text-[0.65rem] truncate leading-tight flex flex-col gap-0.5 ${
                        app.type === 'visita' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                        app.type === 'negociação' ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100' :
                        app.type === 'follow-up' ? 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100' :
                        'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <span className="font-bold">{format(parseISO(app.start_time), 'HH:mm')} - {app.title}</span>
                      {app.clients?.nome && <span className="opacity-70 font-medium whitespace-nowrap">Cli: {app.clients.nome}</span>}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}

function ScheduleModal({ isOpen, onClose, initialData, clients, onSuccess }: { 
  isOpen: boolean, 
  onClose: () => void, 
  initialData?: any, 
  clients: any[],
  onSuccess: () => void 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    clientId: '',
    type: 'visita',
    date: format(new Date(), 'yyyy-MM-dd'),
    startTime: '09:00',
    location: '',
    description: '',
    status: 'scheduled'
  });

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setFormData({
          title: initialData.title || '',
          clientId: initialData.client_id || '',
          type: initialData.type || 'visita',
          date: format(parseISO(initialData.start_time), 'yyyy-MM-dd'),
          startTime: format(parseISO(initialData.start_time), 'HH:mm'),
          location: initialData.location || '',
          description: initialData.description || '',
          status: initialData.status || 'scheduled'
        });
      } else {
        setFormData({
          title: '',
          clientId: '',
          type: 'visita',
          date: format(new Date(), 'yyyy-MM-dd'),
          startTime: '09:00',
          location: '',
          description: '',
          status: 'scheduled'
        });
      }
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const startTime = `${formData.date}T${formData.startTime}:00Z`;
      
      const payload = {
        user_id: user.id,
        client_id: formData.clientId || null,
        title: formData.title,
        type: formData.type,
        start_time: startTime,
        location: formData.location,
        description: formData.description,
        status: formData.status,
        updated_at: new Date().toISOString()
      };

      if (initialData) {
        const { error } = await supabase
          .from('appointments')
          .update(payload)
          .eq('id', initialData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('appointments')
          .insert([payload]);
        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!initialData) return;
    if (!confirm("Tem certeza que deseja cancelar este evento?")) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', initialData.id);
      if (error) throw error;
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-2xl overflow-hidden"
      >
        <div className="p-10 border-b border-slate-50 flex justify-between items-center">
          <div>
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Agenda Profissional</span>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {initialData ? 'Editar Agendamento' : 'Nova Atividade'}
            </h3>
          </div>
          <button onClick={onClose} className="p-4 bg-slate-50 text-slate-400 rounded-2xl transition-all">
            <Plus className="w-6 h-6 rotate-45" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-10 space-y-8">
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold flex items-center gap-2">
              <ShieldAlert className="w-5 h-5" />
              {error}
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Assunto / Título</label>
              <input 
                required
                type="text" 
                value={formData.title} 
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                placeholder="Ex: Visita no Edifício Horizon"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo de Atividade</label>
                <select 
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none"
                >
                  <option value="visita">🏡 Visita</option>
                  <option value="negociação">🤝 Negociação</option>
                  <option value="follow-up">📞 Follow-up</option>
                  <option value="anotação">📝 Anotação/Tarefa</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Vincular Cliente</label>
                <select 
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none"
                >
                  <option value="">Nenhum</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Data</label>
                <input 
                  required
                  type="date" 
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Horário</label>
                <input 
                  required
                  type="time" 
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Local / Link</label>
              <div className="relative">
                <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                <input 
                  type="text" 
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 pl-12 pr-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                  placeholder="Endereço ou link da reunião"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Notas / Detalhes</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all min-h-[100px] resize-none"
                placeholder="Observações adicionais para este compromisso..."
              />
            </div>
            
            <div className="flex gap-3">
               <button 
                type="button"
                className="flex items-center gap-2 px-4 py-3 bg-red-50 text-red-600 rounded-xl text-[0.65rem] font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Google Calendar
              </button>
               <button 
                type="button"
                className="flex items-center gap-2 px-4 py-3 bg-blue-50 text-blue-600 rounded-xl text-[0.65rem] font-bold"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Outlook
              </button>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50 flex justify-end items-center gap-4">
            {initialData && (
              <button 
                type="button"
                onClick={handleDelete}
                className="mr-auto px-6 py-4 text-red-400 font-bold hover:text-red-600 transition-all flex items-center gap-2"
              >
                <Trash2 className="w-5 h-5" />
                Excluir
              </button>
            )}
            <button 
              type="button"
              onClick={onClose}
              className="px-8 py-4 text-slate-400 font-bold hover:text-slate-600 transition-all"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              disabled={loading}
              className="px-10 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50"
            >
              {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Agendar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

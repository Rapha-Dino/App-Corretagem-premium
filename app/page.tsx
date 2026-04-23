// Force rebuild for Supabase integration
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSupabase } from '@/lib/SupabaseProvider';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Settings, 
  LogOut, 
  Search, 
  Bell, 
  Zap, 
  Calendar,
  Plus,
  ArrowRight,
  MapPin,
  Building2,
  MessageCircle,
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
  ArrowUpDown,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
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
  parseISO,
  isBefore,
  startOfToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Cropper from 'react-easy-crop';
import Papa from 'papaparse';
import { PortfolioView } from '@/components/PortfolioView';
import { MatchesView } from '@/components/MatchesView';
import { PropertyDetailModal } from '@/components/PropertyDetailModal';
import { Dashboard } from '@/components/Dashboard';
import { ClientDetail } from '@/components/ClientDetail';

import { 
  getClientPhoto, 
  getCleanClient, 
  cleanPhoneNumberForWhatsApp,
  getCroppedImg
} from '@/lib/utils';

// Types
type View = 'dashboard' | 'clients' | 'pipeline' | 'settings' | 'client-detail' | 'portfolio' | 'financial' | 'analytics' | 'calendar' | 'matches';

export default function Home() {
  const { user, profile } = useSupabase();
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [selectedViewAppointment, setSelectedViewAppointment] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    totalClients: 0,
    activePipeline: 0,
    salesThisMonth: 0
  });
  const [dbError, setDbError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [selectedPropertyForDetail, setSelectedPropertyForDetail] = useState<any>(null);

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
        
        // Try ordering by created_at first (standard)
        const query = supabase
          .from('clients')
          .select('*')
          .eq('user_id', user.id);
        
        let { data, error } = await query.order('created_at', { ascending: false });
        
        // Fallback: if created_at fails, try data_entrada or no order
        if (error && (error.message?.includes('column "created_at" does not exist') || error.code === '42703')) {
          console.warn("[DIAGNOSTIC] 'created_at' column missing, falling back to 'data_entrada'");
          const fallback = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', user.id)
            .order('data_entrada', { ascending: false });
          data = fallback.data;
          error = fallback.error;
          
          if (error) {
             console.warn("[DIAGNOSTIC] Fallback to 'data_entrada' also failed, fetching without order");
             const simpleFetch = await supabase
               .from('clients')
               .select('*')
               .eq('user_id', user.id);
             data = simpleFetch.data;
             error = simpleFetch.error;
          }
        }
        
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
          const cleanedClients = data.map(getCleanClient);
          setClients(cleanedClients);
          updateMetrics(cleanedClients);
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
          .select('*, clients(nome, telefone, whatsapp)')
          .eq('user_id', user.id)
          .order('start_time', { ascending: true });
        
        if (error) throw error;
        setAppointments(data || []);
      } catch (err: any) {
        console.error("Error fetching appointments:", err);
      }
    };

    fetchAppointments();

    const fetchProperties = async () => {
      try {
        if (!supabase) return;
        const { data, error } = await supabase
          .from('properties')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        setProperties(data || []);
      } catch (err: any) {
        console.error("Error fetching properties:", err);
      }
    };

    fetchProperties();

    // Subscribe to changes
    const channel = supabase
      .channel('db_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, () => {
        fetchClients();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        fetchProperties();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshKey]);

  const notificationsAppointments = useMemo(() => {
    const now = new Date();
    const limit = new Date(now.getTime() + 180 * 60 * 60 * 1000);
    return appointments.filter(app => {
      const start = new Date(app.start_time);
      return start >= now && start <= limit;
    });
  }, [appointments]);

  // Logout handler
  const handleLogout = () => supabase.auth.signOut();

  const closeSidebar = () => setIsSidebarOpen(false);

  const openClientDetail = (id: string) => {
    setSelectedClientId(id);
    setActiveView('client-detail');
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
            { id: 'matches', label: 'Matches', icon: '🎯' },
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
                 activeView === 'matches' ? 'Matches Inteligentes' :
                 activeView === 'financial' ? 'Gestão Financeira' :
                 activeView === 'analytics' ? 'Relatórios e Análises' : 
                 activeView === 'settings' ? 'Usuário' : 
                 'Detalhes do Cliente'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-6">
            <div className="flex items-center gap-1 md:gap-3 relative">
              <button className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all relative">
                <MailIcon className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              <div className="relative">
                <button 
                  onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                  className="w-8 h-8 md:w-9 md:h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all relative"
                >
                  <Bell className="w-4 h-4 md:w-5 md:h-5" />
                  {notificationsAppointments.length > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                  )}
                </button>

                <AnimatePresence>
                  {isNotificationsOpen && (
                    <>
                      <div 
                        className="fixed inset-0 z-40" 
                        onClick={() => setIsNotificationsOpen(false)}
                      />
                      <motion.div 
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden"
                      >
                        <div className="p-4 border-b border-slate-50 bg-slate-50/50">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-widest">Notificações (180h)</h4>
                        </div>
                        <div className="max-h-[300px] overflow-y-auto">
                          {notificationsAppointments.length > 0 ? (
                            <div className="divide-y divide-slate-50">
                              {notificationsAppointments.map((app) => (
                                <div 
                                  key={app.id} 
                                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer"
                                  onClick={() => {
                                    setActiveView('calendar');
                                    setIsNotificationsOpen(false);
                                  }}
                                >
                                  <div className="flex items-center gap-3 mb-1">
                                    <div className={`p-1.5 rounded-lg ${
                                      app.type === 'visita' ? 'bg-emerald-100 text-emerald-600' :
                                      app.type === 'negociação' ? 'bg-amber-100 text-amber-600' :
                                      'bg-blue-100 text-blue-600'
                                    }`}>
                                      {app.type === 'visita' ? <Building2 className="w-3.5 h-3.5" /> : 
                                       app.type === 'negociação' ? <Zap className="w-3.5 h-3.5" /> : 
                                       <Calendar className="w-3.5 h-3.5" />}
                                    </div>
                                    <p className="text-xs font-bold text-slate-900 truncate">{app.title}</p>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                      <span>{app.clients?.nome || 'Sem cliente'}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (!app.clients?.whatsapp) {
                                            alert("cliente sem whatsapp");
                                            return;
                                          }
                                          const phone = cleanPhoneNumberForWhatsApp(app.clients.whatsapp);
                                          const date = format(parseISO(app.start_time), 'dd/MM/yyyy');
                                          const time = format(parseISO(app.start_time), 'HH:mm');
                                          const message = encodeURIComponent(`Olá ${app.clients.nome}, aqui é o Rogério. Gostaria de confirmar nosso agendamento de ${app.type || 'reunião'} no dia ${date} às ${time}. Podemos confirmar?`);
                                          window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                                        }}
                                        className="text-emerald-500 hover:text-emerald-600 transition-colors"
                                      >
                                        <MessageCircle className="w-3 h-3 fill-current" />
                                      </button>
                                    </div>
                                    <span>{format(parseISO(app.start_time), 'dd/MM HH:mm')}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="p-8 text-center">
                              <p className="text-xs text-slate-400 font-bold">Sem agendamentos próximos.</p>
                            </div>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            setActiveView('calendar');
                            setIsNotificationsOpen(false);
                          }}
                          className="w-full p-4 text-[10px] font-black text-blue-600 uppercase tracking-widest hover:bg-blue-50 transition-colors border-t border-slate-50"
                        >
                          Ver agenda completa
                        </button>
                      </motion.div>
                    </>
                  )}
                </AnimatePresence>
              </div>
            </div>
              <div 
                onClick={() => setActiveView('settings')}
                className="flex items-center gap-2 md:gap-3 pl-2 md:pl-6 border-l border-slate-100 group cursor-pointer hover:bg-slate-50/50 transition-all rounded-r-xl"
              >
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
            {activeView === 'dashboard' && (
              <Dashboard 
                metrics={metrics} 
                clients={clients} 
                appointments={appointments} 
                properties={properties}
                onClientClick={openClientDetail} 
                onAddLead={() => { setEditingClient(null); setIsLeadModalOpen(true); }} 
                onSchedule={() => setActiveView('calendar')} 
                onPropertyClick={(prop) => setSelectedPropertyForDetail(prop)}
              />
            )}
            {activeView === 'clients' && <ClientLedger clients={clients} onClientClick={openClientDetail} onAddLead={() => { setEditingClient(null); setIsLeadModalOpen(true); }} onRefresh={refreshClientsData} />}
            {activeView === 'calendar' && (
              <CalendarView 
                appointments={appointments} 
                onEdit={(app) => { setSelectedViewAppointment(app); }}
                onAdd={() => { setEditingAppointment(null); setIsScheduleModalOpen(true); }}
              />
            )}
            {activeView === 'portfolio' && (
              <PortfolioView 
                onRefresh={refreshClientsData}
              />
            )}
            {activeView === 'matches' && (
              <MatchesView 
                onClientClick={openClientDetail}
                onPropertyClick={(prop) => setSelectedPropertyForDetail(prop)}
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
            {['pipeline', 'financial', 'analytics'].includes(activeView) && (
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
      
      <AppointmentDetailModal
        isOpen={!!selectedViewAppointment}
        onClose={() => setSelectedViewAppointment(null)}
        appointment={selectedViewAppointment}
        onEdit={(app) => {
          setSelectedViewAppointment(null);
          setEditingAppointment(app);
          setIsScheduleModalOpen(true);
        }}
        onDelete={async (id) => {
          try {
            await supabase.from('appointments').delete().eq('id', id);
            refreshClientsData();
            setSelectedViewAppointment(null);
          } catch (err) {
            console.error("Error deleting appointment:", err);
          }
        }}
      />
      
      {selectedPropertyForDetail && (
        <PropertyDetailModal 
          property={selectedPropertyForDetail}
          onClose={() => setSelectedPropertyForDetail(null)}
          onEdit={() => {
            // Se precisar editar, podemos levar para o portfolio ou abrir o modal de edição aqui
            // Por simplicidade agora, apenas fecha e avisa
            setActiveView('portfolio');
            setSelectedPropertyForDetail(null);
          }}
          onRefresh={refreshClientsData}
        />
      )}
    </div>
  );
}

// --- Sub-Views ---


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
      <div className="flex flex-col lg:flex-row justify-between items-center gap-6 mb-10 mt-4">
        {/* Lado Esquerdo: Título */}
        <div className="lg:flex-1 w-full lg:w-auto text-center lg:text-left">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">Lista de Clientes</h2>
          <p className="text-[10px] text-slate-400 mt-0.5 font-bold uppercase tracking-wider">Gestão de Carteira Executiva</p>
        </div>

        {/* Centro: Novo Lead (Menor e menos destacado) */}
        <div className="lg:flex-1 flex justify-center w-full lg:w-auto order-first lg:order-none">
          <button 
            onClick={onAddLead}
            className="w-full lg:w-auto px-8 py-3 bg-[#0f172a] text-white rounded-2xl text-xs font-black flex items-center justify-center gap-3 hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20 active:scale-95 group border-2 border-slate-100/50"
          >
            <div className="p-1 bg-white/10 rounded-lg group-hover:rotate-90 transition-transform duration-500">
               <Plus className="w-4 h-4" />
            </div>
            <span>NOVO LEAD EXECUTIVO</span>
          </button>
        </div>

        {/* Lado Direito: Ações Secundárias (Menores) */}
        <div className="lg:flex-1 flex items-center gap-2 w-full lg:w-auto justify-center lg:justify-end">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleImportCSV} 
            className="hidden" 
            accept=".csv"
          />
          <div className="flex bg-white p-0.5 rounded-xl border border-slate-100 shadow-sm transition-all">
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3 py-1.5 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              {isImporting ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-2.5 h-2.5 border-2 border-slate-300 border-t-transparent rounded-full" /> : <Upload className="w-3 h-3" />}
              Importar
            </button>
            <div className="w-[1px] h-3 bg-slate-50 my-auto mx-0.5" />
            <button className="px-3 py-1.5 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 hover:bg-slate-50 transition-all">
              <Download className="w-3 h-3" />
              Exportar
            </button>
          </div>
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
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!client.whatsapp) {
                            alert("cliente sem whatsapp");
                            return;
                          }
                          window.open(`https://wa.me/${cleanPhoneNumberForWhatsApp(client.whatsapp)}`, '_blank');
                        }}
                        className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                        title="Conversar no WhatsApp"
                      >
                        <MessageCircle className="w-3.5 h-3.5 fill-current" />
                      </button>
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
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!client.whatsapp) {
                              alert("cliente sem whatsapp");
                              return;
                            }
                            window.open(`https://wa.me/${cleanPhoneNumberForWhatsApp(client.whatsapp)}`, '_blank');
                          }}
                          className="p-1 px-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all"
                          title="Conversar no WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3 fill-current" />
                        </button>
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



function SettingsView({ profile }: { profile: any }) {
  const [name, setName] = useState(profile?.name || '');
  const [whatsapp, setWhatsapp] = useState(profile?.whatsapp || '');
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
          whatsapp,
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
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Meu WhatsApp (para lembretes)</label>
            <input 
              type="text" 
              value={whatsapp} 
              onChange={(e) => setWhatsapp(e.target.value)} 
              placeholder="Ex: 5511999999999"
              className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 px-4 focus:ring-2 focus:ring-blue-900/20 outline-none transition-all" 
            />
            <p className="text-[10px] text-slate-400 font-medium ml-1">Insira seu número com DDD para receber avisos automáticos de agenda.</p>
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
          <h4 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
            <RefreshCw className="w-5 h-5" /> Integrações (Calendário)
          </h4>
          <p className="text-xs text-slate-500 mb-6 leading-relaxed">
            Conecte sua agenda com provedores externos para sincronizar compromissos automaticamente. 
            <strong> Requer configuração de Cliente ID e Segredo nas variáveis de ambiente.</strong>
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-lg">G</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Google Calendar</p>
                  <p className="text-[10px] text-slate-400 font-medium">Status: Não configurado</p>
                </div>
              </div>
              <button 
                onClick={() => alert("Configure GOOGLE_CLIENT_ID nas configurações do projeto para habilitar.")}
                className="px-4 py-2 bg-white border border-slate-200 text-[#003366] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 transition-all"
              >
                Conectar
              </button>
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
                  <span className="text-lg text-blue-500">M</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Microsoft Outlook (Hotmail)</p>
                  <p className="text-[10px] text-slate-400 font-medium">Status: Não configurado</p>
                </div>
              </div>
              <button 
                onClick={() => alert("Configure MICROSOFT_CLIENT_ID nas configurações do projeto para habilitar.")}
                className="px-4 py-2 bg-white border border-slate-200 text-[#003366] text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-50 transition-all"
              >
                Conectar
              </button>
            </div>
            
            <div className="p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
              <p className="text-[10px] font-bold text-[#003366] uppercase tracking-[0.05em] mb-2">URLs de Callback (Redirecionamento):</p>
              <code className="text-[9px] block bg-white p-2 border border-blue-100 rounded-lg break-all">
                {typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : 'URL da aplicação'}
              </code>
            </div>
          </div>
        </div>

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
        // Tentamos salvar o texto diretamente. Se o banco for INTEGER, vai falhar e caímos no catch/fallback
        andar: formData.floor,
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

      let dbError;
      if (initialData) {
        const { error: updateError } = await supabase
          .from('clients')
          .update(payload)
          .eq('id', initialData.id);
        dbError = updateError;
      } else {
        payload.historico_conversas = [];
        const { error: insertError } = await supabase
          .from('clients')
          .insert([payload]);
        dbError = insertError;
      }

      // Fallback robusto se o banco ainda for do tipo INTEGER
      if (dbError && dbError.message.includes('type integer')) {
        console.log("Fallback: Tentando salvar como inteiro por restrição do banco...");
        const isFloorNumeric = !isNaN(Number(formData.floor)) && formData.floor !== '';
        
        const fallbackPayload = {
          ...payload,
          andar: isFloorNumeric ? Number(formData.floor) : 0,
          outros: !isFloorNumeric && formData.floor ? `[Andar: ${formData.floor}] ${formData.others || ''}` : formData.others
        };
        
        if (initialData) {
          const { error: retryError } = await supabase.from('clients').update(fallbackPayload).eq('id', initialData.id);
          dbError = retryError;
        } else {
          const { error: retryError } = await supabase.from('clients').insert([fallbackPayload]);
          dbError = retryError;
        }
      }

      if (dbError) {
        throw dbError;
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
                    <input type="text" value={formData.floor} onChange={(e) => setFormData({ ...formData, floor: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Ex: 5º ou Alto" />
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
  const [isSyncing, setIsSyncing] = useState(false);
  
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

  const handleSync = () => {
    setIsSyncing(true);
    // Simulating call to show something is happening
    setTimeout(() => {
      setIsSyncing(false);
      alert("Para sincronizar com Google ou Hotmail, é necessário configurar as chaves de API nas Configurações. No momento, a integração está aguardando as credenciais CLIENT_ID e CLIENT_SECRET.");
    }, 1500);
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
            onClick={handleSync} 
            disabled={isSyncing}
            className="hidden md:flex items-center gap-2 px-6 py-3 bg-slate-50 text-slate-500 rounded-2xl border border-slate-100 text-xs font-bold hover:bg-slate-100 transition-all disabled:opacity-50"
          >
            {isSyncing ? (
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isSyncing ? 'Sincronizando...' : 'Sincronizar'}
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
        <div className="grid grid-cols-7 border-b border-slate-200">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-4 text-center text-[0.6rem] font-black text-[#003366] uppercase tracking-widest border-r border-slate-200 last:border-r-0">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayApps = getDayAppointments(day);
            const isTodayDay = isToday(day);
            const isCurrentMonth = isSameMonth(day, monthStart);
            const isPastDay = isBefore(day, startOfToday());

            return (
              <div 
                key={idx} 
                className={`min-h-[140px] p-2 border-r border-b border-slate-200 last:border-r-0 relative transition-all hover:bg-slate-50 cursor-pointer group 
                  ${!isCurrentMonth ? 'bg-slate-50/50 opacity-40' : isPastDay ? 'bg-slate-50/80' : 'bg-white'}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className={`text-sm font-black w-8 h-8 flex items-center justify-center rounded-xl transition-all ${
                    isTodayDay 
                      ? 'bg-[#1E90FF] text-white shadow-lg shadow-blue-200' 
                      : !isCurrentMonth 
                        ? 'text-slate-300' 
                        : isPastDay 
                          ? 'text-slate-400' 
                          : 'text-[#00008B]'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                
                <div className="space-y-1.5 overflow-hidden">
                  {dayApps.map(app => (
                    <div
                      key={app.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); onEdit(app); }}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onEdit(app); } }}
                      className={`w-full text-left p-2 rounded-xl border transition-all text-[0.65rem] truncate leading-tight flex flex-col gap-0.5 cursor-pointer ${
                        app.type === 'visita' ? 'bg-emerald-50 border-emerald-100 text-emerald-700 hover:bg-emerald-100' :
                        app.type === 'negociação' ? 'bg-amber-50 border-amber-100 text-amber-700 hover:bg-amber-100' :
                        app.type === 'follow-up' ? 'bg-blue-50 border-blue-100 text-blue-700 hover:bg-blue-100' :
                        'bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="font-bold">{format(parseISO(app.start_time), 'HH:mm')} - {app.title}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!app.clients?.whatsapp) {
                              alert("cliente sem whatsapp");
                              return;
                            }
                            const phone = cleanPhoneNumberForWhatsApp(app.clients.whatsapp);
                            const date = format(parseISO(app.start_time), 'dd/MM/yyyy');
                            const time = format(parseISO(app.start_time), 'HH:mm');
                            const message = encodeURIComponent(`Olá ${app.clients.nome}, aqui é o Rogério. Gostaria de confirmar nosso agendamento de ${app.type || 'reunião'} no dia ${date} às ${time}. Podemos confirmar?`);
                            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                          }}
                          className="p-1 hover:bg-white/50 rounded-lg transition-all"
                          title="Enviar confirmação via WhatsApp"
                        >
                          <MessageCircle className="w-3 h-3 fill-current" />
                        </button>
                      </div>
                      {app.clients?.nome && <span className="opacity-70 font-medium whitespace-nowrap">Cli: {app.clients.nome}</span>}
                    </div>
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
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
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
      setShowConfirmDelete(false);
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

      const startTime = new Date(`${formData.date}T${formData.startTime}:00`).toISOString();
      
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
    
    if (!showConfirmDelete) {
      setShowConfirmDelete(true);
      return;
    }

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
                <div className="flex gap-2">
                  <select 
                    value={formData.startTime.split(':')[0]}
                    onChange={(e) => {
                      const newHour = e.target.value;
                      const minutes = formData.startTime.split(':')[1] || '00';
                      setFormData({ ...formData, startTime: `${newHour}:${minutes}` });
                    }}
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none text-center"
                  >
                    {Array.from({ length: 24 }).map((_, i) => {
                      const h = i.toString().padStart(2, '0');
                      return <option key={h} value={h}>{h}h</option>;
                    })}
                  </select>
                  <div className="flex items-center text-slate-300 font-bold">:</div>
                  <select 
                    value={formData.startTime.split(':')[1]}
                    onChange={(e) => {
                      const newMinutes = e.target.value;
                      const hour = formData.startTime.split(':')[0] || '09';
                      setFormData({ ...formData, startTime: `${hour}:${newMinutes}` });
                    }}
                    className="flex-1 bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all appearance-none text-center"
                  >
                    <option value="00">00</option>
                    <option value="15">15</option>
                    <option value="30">30</option>
                    <option value="45">45</option>
                  </select>
                </div>
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
            
            <div className="flex flex-wrap gap-3">
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
              {formData.clientId && (
                <button 
                  type="button"
                  onClick={() => {
                    const selectedClient = clients.find(c => c.id === formData.clientId);
                    if (!selectedClient?.whatsapp) {
                      alert("cliente sem whatsapp");
                      return;
                    }
                    const phone = cleanPhoneNumberForWhatsApp(selectedClient.whatsapp);
                    const formattedDate = format(parseISO(formData.date), 'dd/MM/yyyy');
                    const message = encodeURIComponent(`Olá ${selectedClient.nome}, aqui é o Rogério. Gostaria de confirmar nosso agendamento de ${formData.type || 'reunião'} no dia ${formattedDate} às ${formData.startTime}. Podemos confirmar?`);
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                  }}
                  className="flex items-center gap-2 px-4 py-3 bg-emerald-50 text-emerald-600 rounded-xl text-[0.65rem] font-bold hover:bg-emerald-100 transition-all border border-emerald-100"
                >
                  <MessageCircle className="w-3.5 h-3.5 fill-current" />
                  Enviar WhatsApp
                </button>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-slate-50 flex justify-end items-center gap-4">
            {initialData && (
              <button 
                type="button"
                onClick={handleDelete}
                className={`mr-auto px-6 py-4 rounded-2xl font-bold transition-all flex items-center gap-2 ${
                  showConfirmDelete 
                    ? 'bg-red-600 text-white shadow-lg shadow-red-200' 
                    : 'text-red-400 hover:text-red-600'
                }`}
              >
                {showConfirmDelete ? (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Confirmar Exclusão?
                  </>
                ) : (
                  <>
                    <Trash2 className="w-5 h-5" />
                    Excluir
                  </>
                )}
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

function AppointmentDetailModal({ isOpen, onClose, appointment, onEdit, onDelete }: {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  onEdit: (app: any) => void;
  onDelete: (id: string) => void;
}) {
  if (!isOpen || !appointment) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden"
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <div>
            <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Agenda Profissional</span>
            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{appointment.title}</h3>
          </div>
          <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-xl transition-all">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-1">
              <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Tipo</span>
              <p className="text-sm font-bold text-slate-900 capitalize uppercase">{appointment.type || '---'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Cliente</span>
              <p className="text-sm font-bold text-slate-900">{appointment.clients?.nome || 'Não vinculado'}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Data</span>
              <p className="text-sm font-bold text-slate-900">{format(parseISO(appointment.start_time), 'dd/MM/yyyy')}</p>
            </div>
            <div className="space-y-1">
              <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Horário</span>
              <p className="text-sm font-bold text-slate-900">{format(parseISO(appointment.start_time), 'HH:mm')}</p>
            </div>
          </div>

          {appointment.location && (
            <div className="space-y-1">
              <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Local / Link</span>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <MapPin className="w-4 h-4 text-blue-500" />
                <span className="truncate">{appointment.location}</span>
              </div>
            </div>
          )}

          {appointment.description && (
            <div className="space-y-1">
              <span className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Notas</span>
              <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {appointment.description}
              </p>
            </div>
          )}
        </div>

        <div className="p-8 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={() => {
              if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                onDelete(appointment.id);
              }
            }}
            className="px-6 py-3 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-100/50 rounded-xl transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Excluir
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-slate-600 transition-all"
          >
            Fechar
          </button>
          <button
            onClick={() => onEdit(appointment)}
            className="px-10 py-4 bg-slate-900 text-white rounded-[1rem] font-black text-[11px] uppercase tracking-widest hover:scale-[1.02] transition-all flex items-center gap-2 shadow-xl shadow-slate-900/20"
          >
            Editar Informações
          </button>
        </div>
      </motion.div>
    </div>
  );
}


// Force rebuild for Supabase integration
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSupabase } from '@/lib/SupabaseProvider';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  GitBranch, 
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
  Kanban
} from 'lucide-react';
import { format } from 'date-fns';
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
  ResponsiveContainer, 
  Cell 
} from 'recharts';

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

const FunnelChart = ({ clients }: { clients: any[] }) => {
  const data = [
    { name: 'Lead', value: clients.filter(c => c.status === 'Ativo').length },
    { name: 'Visita', value: clients.filter(c => c.status === 'Visita').length },
    { name: 'Negociação', value: clients.filter(c => c.status === 'Negociação').length },
    { name: 'Venda', value: clients.filter(c => c.status === 'Fechado').length },
  ];

  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-64 w-full bg-slate-50 animate-pulse rounded-xl" />;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="name" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
            dy={10}
          />
          <Tooltip 
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index % 2 === 0 ? '#0f172a' : '#cbd5e1'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Types
type View = 'dashboard' | 'clients' | 'pipeline' | 'settings' | 'client-detail' | 'portfolio' | 'financial' | 'analytics';

export default function Home() {
  const { user, profile, refreshProfile } = useSupabase();
  const [activeView, setActiveView] = useState<View>('dashboard');

  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
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

    // Subscribe to changes
    const channel = supabase
      .channel('clients_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        fetchClients(); // Refresh on any change
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
  }, [user, clients.length]);

  const handleLogout = () => supabase.auth.signOut();

  const openClientDetail = (id: string) => {
    setSelectedClientId(id);
    setActiveView('client-detail');
  };

  return (
    <div className="flex min-h-screen bg-[#f8fafc] text-slate-900 font-sans">
      {/* Sidebar Navigation */}
      <aside className="fixed left-0 top-0 h-full w-72 bg-white border-r border-slate-100 z-50 flex flex-col">
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
            <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none">Nexus Imobi</h1>
            <p className="text-[0.6rem] uppercase font-bold tracking-widest text-slate-400 mt-1">Gestão Imobiliária</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {[
            { id: 'dashboard', label: 'Início', icon: '📊' },
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
            onClick={() => setActiveView('settings')}
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
      <main className="ml-72 flex-1 flex flex-col min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-40 bg-white px-8 py-6 flex justify-between items-center border-b border-slate-100">
          <div className="flex items-center gap-8">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {activeView === 'dashboard' ? 'Painel de Controle' : 
                 activeView === 'clients' ? 'Lista de Clientes' : 
                 activeView === 'pipeline' ? 'Pipeline de Vendas' : 
                 activeView === 'portfolio' ? 'Portfólio de Imóveis' :
                 activeView === 'financial' ? 'Gestão Financeira' :
                 activeView === 'analytics' ? 'Relatórios e Análises' : 'Detalhes do Cliente'}
              </h2>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <button className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all relative">
                <MailIcon className="w-5 h-5" />
              </button>
              <button className="w-9 h-9 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-all relative">
                <Bell className="w-5 h-5" />
              </button>
            </div>
              <div className="flex items-center gap-3 pl-6 border-l border-slate-100 group cursor-pointer">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-bold text-slate-900">{profile?.name || user?.email?.split('@')[0]}</p>
                  <p className="text-xs text-slate-400">Corretor</p>
                </div>
                {profile?.photo_url ? (
                  <img 
                    src={profile.photo_url} 
                    alt="Profile" 
                    className="w-10 h-10 rounded-full object-cover bg-slate-100"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                    <User className="w-5 h-5" />
                  </div>
                )}
              </div>
          </div>
        </header>

        {/* View Content */}
        <div className="p-8 flex-1">
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && <Dashboard metrics={metrics} clients={clients} onClientClick={openClientDetail} onAddLead={() => { setEditingClient(null); setIsLeadModalOpen(true); }} />}
            {activeView === 'clients' && <ClientLedger clients={clients} onClientClick={openClientDetail} onAddLead={() => { setEditingClient(null); setIsLeadModalOpen(true); }} onRefresh={refreshClientsData} />}
            {activeView === 'pipeline' && <Pipeline clients={clients} onClientClick={openClientDetail} />}
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
    </div>
  );
}

// --- Sub-Views ---

function Dashboard({ clients, onClientClick, onAddLead }: { clients: any[], onClientClick: (id: string) => void, onAddLead: () => void }) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const stats = [
    { label: 'Total de Clientes', value: clients.length, trend: '+12%', icon: Users, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pipeline Ativo', value: clients.filter(c => c.status !== 'Fechado' && c.status !== 'Parado').length, trend: '+5%', icon: Target, color: 'bg-emerald-50 text-emerald-600' },
    { label: 'Vendas este Mês', value: clients.filter(c => c.status === 'Fechado').length, trend: '+2%', icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
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

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl ${stat.color} transition-transform group-hover:scale-110`}>
                <stat.icon className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-emerald-500 bg-emerald-50 px-2 py-1 rounded-lg">{stat.trend}</span>
            </div>
            <p className="text-sm font-bold text-[#003366]">{stat.label}</p>
            <h4 className="text-3xl font-bold text-slate-900 mt-1">{stat.value}</h4>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-12 gap-8">
        {/* Funnel Chart */}
        <div className="col-span-12 lg:col-span-7 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-lg font-bold text-slate-900">Funil de Vendas</h3>
            <button className="text-xs font-bold text-blue-600 hover:underline">Ver Detalhes</button>
          </div>
          <div className="h-[300px] w-full">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
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
        <div className="col-span-12 lg:col-span-5 bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Atividade Recente</h3>
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
        <div className="p-8 border-b border-slate-50 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900">Leads Ativos no Portfólio</h3>
          <button className="px-4 py-2 bg-slate-50 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-all">
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
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useSupabase();

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleClearAll = async () => {
    if (!user) return;
    
    try {
      setIsImporting(true);
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setNotification({
        type: 'success',
        message: "Todos os clientes foram excluídos com sucesso!"
      });
      setShowConfirmClear(false);
      onRefresh();
    } catch (err: any) {
      console.error("Clear error:", err);
      setNotification({
        type: 'error',
        message: "Erro ao excluir clientes: " + err.message
      });
    } finally {
      setIsImporting(false);
    }
  };

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
        } catch (e) {
          return undefined;
        }
      }
      
      // If it's a string, try to parse it normally
      try {
        const date = new Date(strVal);
        if (!isNaN(date.getTime()) && date.getFullYear() > 1900) {
          return date.toISOString().split('T')[0];
        }
      } catch (e) {
        // Ignore
      }
      
      return undefined;
    };

    setIsImporting(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: ";", // Support semicolon separated files
      complete: async (results) => {
        try {
          if (results.errors.length > 0) {
            // If semicolon failed, try auto-detect
            if (results.errors[0].code === "TooFewFields") {
              Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
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
            user_id: user.id,
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
          <div className="relative">
            <button 
              onClick={() => setShowConfirmClear(!showConfirmClear)}
              disabled={isImporting}
              className="flex-1 md:flex-none px-6 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-red-100 transition-all disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              Limpar Tudo
            </button>
            
            {showConfirmClear && (
              <div className="absolute top-full mt-2 right-0 w-64 bg-white border border-slate-100 shadow-xl rounded-2xl p-4 z-50">
                <p className="text-[0.7rem] font-bold text-slate-600 mb-3">Tem certeza? Isso apagará TODOS os clientes.</p>
                <div className="flex gap-2">
                  <button 
                    onClick={handleClearAll}
                    className="flex-1 py-2 bg-red-500 text-white text-[0.65rem] font-bold rounded-lg hover:bg-red-600 transition-all"
                  >
                    Sim, Apagar
                  </button>
                  <button 
                    onClick={() => setShowConfirmClear(false)}
                    className="flex-1 py-2 bg-slate-100 text-slate-600 text-[0.65rem] font-bold rounded-lg hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}
          </div>
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

      {/* Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-8 py-5 border-b border-slate-50 text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">
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
              <div 
                key={client.id} 
                onClick={() => onClientClick(client.id)}
                className="grid grid-cols-12 px-8 py-6 items-center hover:bg-slate-50 transition-colors cursor-pointer group"
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
                  <p className="text-sm text-slate-900 font-bold">{client.whatsapp || client.telefone || 'N/A'}</p>
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
            ))
          )}
        </div>
      </div>
    </motion.div>
  );
}

function Pipeline({ clients, onClientClick }: { clients: any[], onClientClick: (id: string) => void }) {
  const stages = [
    { id: 'Ativo', label: 'Novos Leads', color: 'bg-blue-500' },
    { id: 'Em Atendimento', label: 'Em Atendimento', color: 'bg-amber-500' },
    { id: 'Visita', label: 'Visitas Agendadas', color: 'bg-purple-500' },
    { id: 'Negociação', label: 'Em Negociação', color: 'bg-emerald-500' },
    { id: 'Fechado', label: 'Fechados', color: 'bg-slate-900' }
  ];
  
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="space-y-10"
    >
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-black text-slate-900 tracking-tight">Pipeline de Vendas</h3>
          <p className="text-[#003366] text-xs font-bold uppercase tracking-widest mt-1">Gestão de Fluxo de Trabalho</p>
        </div>
        <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-right">
            <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest">Valor Total</p>
            <p className="text-lg font-black text-slate-900">
              R$ {clients.reduce((acc, c) => acc + (Number(c.valor_buscado) || 0), 0).toLocaleString()}
            </p>
          </div>
          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-blue-600" />
          </div>
        </div>
      </div>

      <div className="flex gap-8 min-w-full items-start pb-10 overflow-x-auto no-scrollbar">
        {stages.map((stage) => (
          <div key={stage.id} className="flex flex-col gap-6 min-w-[320px] max-w-[320px]">
            <div className="flex justify-between items-center px-2">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-[0.7rem] font-black uppercase tracking-[0.15em] text-slate-900">{stage.label}</span>
              </div>
              <span className="text-[0.65rem] font-bold text-[#003366] bg-slate-100 px-2.5 py-1 rounded-lg">
                {clients.filter(c => c.status === stage.id).length}
              </span>
            </div>
            
            <div className="space-y-4 min-h-[500px] p-2 rounded-3xl bg-slate-50/50 border border-dashed border-slate-200/60">
              {clients.filter(c => c.status === stage.id).map((client) => (
                <motion.div 
                  layoutId={client.id}
                  key={client.id} 
                  onClick={() => onClientClick(client.id)}
                  className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 hover:-translate-y-1 transition-all cursor-pointer group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                  
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
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
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm group-hover:text-blue-600 transition-colors truncate w-32">{client.nome}</h4>
                        <p className="text-[0.65rem] text-[#003366] font-bold">{client.tipo || 'N/A'}</p>
                      </div>
                    </div>
                    <button className="text-slate-300 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Orçamento</p>
                        <p className="text-sm font-black text-slate-900">
                          R$ {client.valor_buscado ? (client.valor_buscado / 1000000).toFixed(1) + 'M' : 'N/A'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[0.6rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Último Contato</p>
                        <div className="flex items-center gap-1.5 text-slate-900 font-bold text-[0.65rem]">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {client.updated_at ? format(new Date(client.updated_at), 'dd MMM') : 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-50 flex items-center justify-between">
                      <div className="flex -space-x-2">
                        {client.bairros?.slice(0, 2).map((b: string, i: number) => (
                          <div key={i} className="px-2 py-0.5 bg-slate-50 border border-white rounded-md text-[0.55rem] font-bold text-slate-400 uppercase tracking-tighter">
                            {b}
                          </div>
                        ))}
                      </div>
                      <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {clients.filter(c => c.status === stage.id).length === 0 && (
                <div className="flex flex-col items-center justify-center py-10 opacity-20">
                  <Plus className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-[0.65rem] font-bold uppercase tracking-widest">Etapa Vazia</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </motion.div>
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
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={onBack} className="p-3 bg-slate-50 text-slate-600 hover:text-slate-900 rounded-2xl transition-all">
            <Plus className="w-5 h-5 rotate-45" />
          </button>
          {getClientPhoto(client) && (
            <img 
              src={getClientPhoto(client)!} 
              alt={client.nome} 
              className="w-20 h-20 rounded-[1.5rem] object-cover border-2 border-slate-50 shadow-sm" 
            />
          )}
          {!getClientPhoto(client) && (
            <div className="w-20 h-20 rounded-[1.5rem] bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100 shadow-sm">
              <User className="w-10 h-10" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest">Lead ID: #{client.id.substring(0, 8)}</span>
            </div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {client.nome}
              {client.aniversario && (
                <span className="ml-3 text-xl font-bold text-[#003366]">
                  ({calculateAge(client.aniversario)} anos)
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-6 mt-6">
              <div className="flex flex-col">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Venda / Locação</p>
                <div className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 shadow-sm min-w-[120px] text-center">
                  {client.v_l || 'Venda'}
                </div>
              </div>
              <div className="flex flex-col">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Status Lead</p>
                <div className={`px-10 py-3 rounded-2xl text-base font-black shadow-lg ${
                  client.status === 'Fechado' ? 'bg-emerald-500 text-white shadow-emerald-200' :
                  client.status === 'Visita' ? 'bg-blue-600 text-white shadow-blue-200' :
                  client.status === 'Negociação' ? 'bg-amber-500 text-white shadow-amber-200' :
                  'bg-slate-100 text-[#003366]'
                } text-center min-w-[160px]`}>
                  {client.status}
                </div>
              </div>
              <div className="flex flex-col">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Código Imóvel</p>
                <div className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 shadow-sm min-w-[120px] text-center">
                  {client.codigo || 'S/C'}
                </div>
              </div>
              <div className="flex flex-col">
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-2">Budget</p>
                <div className="px-6 py-3 bg-white border border-slate-100 rounded-2xl text-sm font-bold text-slate-900 shadow-sm min-w-[120px] text-center">
                  R$ {client.valor_buscado?.toLocaleString() || '0'}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => onEdit(client)}
            className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold shadow-lg shadow-slate-900/20 hover:scale-[1.02] transition-all flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Editar Ficha
          </button>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-3 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl transition-all"
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
            <div className="grid grid-cols-2 divide-x divide-slate-50">
              <div className="p-8 space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-blue-50 rounded-xl text-blue-600">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">E-mail Principal</p>
                    <p className="text-sm font-bold text-slate-900">{client.email || 'Não informado'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-1">WhatsApp / Telefone</p>
                    <p className="text-sm font-bold text-slate-900">{client.whatsapp || client.telefone || 'Não informado'}</p>
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
              <div className="p-8 space-y-6">
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
                <p className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest mb-3">Bairros de Interesse</p>
                <div className="flex flex-wrap gap-2">
                  {client.bairros?.map((b: string, i: number) => (
                    <span key={i} className="px-3 py-1.5 bg-white text-[#003366] text-[0.65rem] font-bold rounded-lg border border-slate-200">
                      {b}
                    </span>
                  )) || <span className="text-xs text-[#003366] font-bold italic">Nenhum bairro selecionado</span>}
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
          <div className="grid grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Imóveis Enviados</h3>
              <p className="text-sm font-bold text-slate-900 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                {client.imovel_enviado || 'Nenhum imóvel enviado ainda.'}
              </p>
            </div>
            <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Feedback do Cliente</h3>
              <p className="text-sm font-bold text-slate-900 bg-slate-50 p-4 rounded-2xl border border-slate-100">
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
          <div className="bg-amber-100 p-8 rounded-3xl border border-amber-200 shadow-sm flex flex-col h-[800px]">
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
        <div className="p-10 border-b border-slate-50 flex justify-between items-center bg-white">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Gestão de Leads</span>
            </div>
            <h3 className="text-3xl font-black text-slate-900 tracking-tight">
              {initialData ? 'Editar Cadastro' : 'Novo Lead Executivo'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-4 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
          >
            <Plus className="w-6 h-6 rotate-45" />
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
            <div className="mx-10 mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <p>{error}</p>
            </div>
          )}
          <div className="p-10 grid grid-cols-1 md:grid-cols-3 gap-12">
            {/* Coluna 1: Perfil & Contato */}
            <div className="space-y-8">
              <div className="flex flex-col items-center mb-10">
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
            <div className="space-y-8">
              <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 space-y-6">
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
                  <label className="text-[0.65rem] font-bold text-[#003366] uppercase tracking-widest ml-1">Bairros de Interesse</label>
                  <div className="space-y-2">
                    <input type="text" value={formData.neighborhood1} onChange={(e) => setFormData({ ...formData, neighborhood1: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-5 text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Bairro Principal" />
                    <input type="text" value={formData.neighborhood2} onChange={(e) => setFormData({ ...formData, neighborhood2: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-5 text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Bairro Secundário" />
                    <input type="text" value={formData.neighborhood3} onChange={(e) => setFormData({ ...formData, neighborhood3: e.target.value })} className="w-full bg-white border border-slate-100 rounded-2xl py-3 px-5 text-xs font-bold text-slate-900 focus:ring-4 focus:ring-blue-50 outline-none transition-all" placeholder="Bairro Terciário" />
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

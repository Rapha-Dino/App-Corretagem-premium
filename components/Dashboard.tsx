'use client'

import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Target, 
  TrendingUp, 
  Plus, 
  Building2, 
  Zap, 
  Calendar, 
  Clock, 
  User 
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { getClientPhoto } from '@/lib/utils';

interface DashboardProps {
  metrics: { totalClients: number, activePipeline: number, salesThisMonth: number };
  clients: any[];
  appointments: any[];
  onClientClick: (id: string) => void;
  onAddLead: () => void;
  onSchedule: () => void;
}

export function Dashboard({ metrics, clients, appointments, onClientClick, onAddLead, onSchedule }: DashboardProps) {
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
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-7 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-slate-900">Funil de Vendas</h3>
          </div>
          <div className="h-[250px] md:h-[300px] w-full relative">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} id="dashboard-funnel-container">
                <BarChart data={funnelData} layout="vertical" margin={{ left: 40, right: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fontSize: 12, fontWeight: 600, fill: '#003366' }} />
                  <Tooltip cursor={{ fill: 'transparent' }} />
                  <Bar dataKey="value" radius={[0, 10, 10, 0]} barSize={40} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="col-span-12 lg:col-span-5 bg-white p-6 md:p-8 rounded-3xl border border-slate-100 shadow-sm">
          <h3 className="text-lg font-bold text-slate-900 mb-6">Atividade Recente</h3>
          <div className="space-y-6">
            {recentLeads.map((client) => (
              <div key={client.id} className="flex items-center gap-4 group cursor-pointer" onClick={() => onClientClick(client.id)}>
                {getClientPhoto(client) ? (
                  <img src={getClientPhoto(client)!} alt="" className="w-10 h-10 rounded-xl object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-300 border border-slate-100">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{client.nome}</p>
                </div>
                <span className="text-[0.65rem] font-bold text-[#003366]">
                  {format(new Date(client.updated_at || client.created_at), 'HH:mm')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

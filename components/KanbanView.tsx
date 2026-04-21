'use client'

import React from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  Search, 
  MapPin, 
  Phone, 
  Mail, 
  Calendar, 
  MessageCircle,
  FileText,
  DollarSign,
  TrendingUp,
  Clock,
  UserPlus
} from 'lucide-react';

interface Client {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  status: string;
  valor_buscado?: string | number;
  foto_url?: string;
}

interface KanbanViewProps {
  clients: Client[];
  clientSearchTerm: string;
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  onEditClient: (client: Client) => void;
  openWhatsApp: (phone: string) => void;
}

const STAGES = ['contato_inicial', 'quente', 'negociacao', 'fechado', 'perdido'];

export function KanbanView({ 
  clients, 
  clientSearchTerm, 
  getStatusColor, 
  getStatusLabel,
  onEditClient,
  openWhatsApp
}: KanbanViewProps) {
  const filteredClients = clients.filter(c => 
    c.nome.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearchTerm.toLowerCase())
  );

  return (
    <div className="flex gap-6 overflow-x-auto pb-4 h-[calc(100vh-12rem)] scrollbar-hide">
      {STAGES.map((status) => {
        const stageClients = filteredClients.filter(c => c.status === status);
        return (
          <div key={status} className="flex-shrink-0 w-80 bg-slate-900/40 rounded-2xl border border-slate-800/50 flex flex-col p-4 backdrop-blur-sm">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(status).split(' ')[0]}`} />
                <h3 className="font-semibold text-slate-200 capitalize">{getStatusLabel(status)}</h3>
              </div>
              <span className="text-xs font-mono text-slate-500 bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700/30">
                {stageClients.length}
              </span>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-hide">
              {stageClients.length > 0 ? (
                stageClients.map((client) => (
                  <motion.div
                    key={client.id}
                    layoutId={client.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="group bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700/30 rounded-xl p-4 transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 cursor-pointer"
                    onClick={() => onEditClient(client)}
                  >
                    <div className="flex gap-3 mb-3">
                      {client.foto_url ? (
                        <div className="w-10 h-10 rounded-full border border-slate-700 overflow-hidden shrink-0">
                          <img src={client.foto_url} alt={client.nome} className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center shrink-0">
                          <Users className="w-5 h-5 text-blue-400" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h4 className="font-medium text-slate-200 text-sm truncate group-hover:text-blue-400 transition-colors">{client.nome}</h4>
                        <div className="flex items-center gap-1 text-[10px] text-slate-500">
                          <Clock className="w-3 h-3" />
                          <span>Atualizado hoje</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-slate-400 mb-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700/20">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="font-mono">{client.valor_buscado ? `R$ ${Number(client.valor_buscado).toLocaleString()}` : 'Não informado'}</span>
                    </div>

                    <div className="flex items-center justify-between gap-1 mt-2">
                       <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          openWhatsApp(client.telefone);
                        }}
                        className="flex-1 flex items-center justify-center p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4" />
                      </button>
                      <button className="flex-1 flex items-center justify-center p-2 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors">
                        <FileText className="w-4 h-4" />
                      </button>
                      <button className="flex-1 flex items-center justify-center p-2 rounded-lg bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 transition-colors">
                        <Calendar className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-8 opacity-20 border-2 border-dashed border-slate-800 rounded-xl">
                  <UserPlus className="w-8 h-8 mb-2" />
                  <p className="text-xs">Vazio</p>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

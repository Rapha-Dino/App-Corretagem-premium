'use client'

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '@/lib/supabase';
import { 
  Plus, 
  User, 
  FileText, 
  Trash2, 
  Mail, 
  Phone, 
  MessageCircle, 
  Zap, 
  Calendar, 
  Building2, 
  CreditCard, 
  AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { 
  calculateAge, 
  getClientPhoto, 
  getCleanClient, 
  cleanPhoneNumberForWhatsApp 
} from '@/lib/utils';

interface ClientDetailProps {
  clientId: string;
  onBack: () => void;
  onEdit: (client: any) => void;
  onDelete: () => void;
  onRefresh: () => void;
}

export function ClientDetail({ clientId, onBack, onEdit, onDelete, onRefresh }: ClientDetailProps) {
  const [client, setClient] = useState<any>(null);
  const [newInteraction, setNewInteraction] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingInteraction, setIsAddingInteraction] = useState(false);
  const [showZoomPhoto, setShowZoomPhoto] = useState(false);

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
                onClick={() => setShowZoomPhoto(true)}
                className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-[1.5rem] object-cover border-2 border-slate-50 shadow-sm flex-shrink-0 cursor-zoom-in hover:scale-105 transition-transform" 
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
        {/* Left Column */}
        <div className="col-span-12 lg:col-span-8 space-y-8">
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
                      <button 
                        onClick={() => {
                          if (!client.whatsapp) {
                            alert("cliente sem whatsapp");
                            return;
                          }
                          window.open(`https://wa.me/${cleanPhoneNumberForWhatsApp(client.whatsapp)}`, '_blank');
                        }}
                        className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all flex items-center gap-2"
                      >
                        <MessageCircle className="w-4 h-4 fill-current" />
                        <span className="text-[0.65rem] font-bold uppercase">WhatsApp</span>
                      </button>
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
                <p className="text-xl font-black text-slate-900">
                  {client.andar || 'N/A'}
                  {client.andar && !isNaN(Number(client.andar)) && 'º'}
                </p>
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
          </div>
        </div>

        {/* Right Column */}
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
                  placeholder="Registrar interação..."
                  className="w-full bg-white border rounded-2xl p-4 text-xs focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px] resize-none shadow-sm"
                />
                <button 
                  onClick={handleAddInteraction}
                  disabled={isAddingInteraction || !newInteraction.trim()}
                  className="absolute right-3 bottom-3 p-3 bg-blue-600 text-white rounded-xl"
                >
                  <FileText className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Modals placeholders for brevity - you can keep them if space allows */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white rounded-[2.5rem] p-10 text-center max-w-md"
            >
               <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-6" />
               <h3 className="text-xl font-bold mb-4">Confirmar Exclusão</h3>
               <p className="text-sm text-slate-500 mb-8">Deseja excluir o lead {client.nome}?</p>
               <div className="grid grid-cols-2 gap-4">
                  <button onClick={() => setShowDeleteConfirm(false)} className="py-3 bg-slate-100 rounded-xl font-bold">Cancelar</button>
                  <button onClick={handleDelete} className="py-3 bg-red-600 text-white rounded-xl font-bold" disabled={isDeleting}>Excluir</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showZoomPhoto && (
          <div onClick={() => setShowZoomPhoto(false)} className="fixed inset-0 z-[120] bg-black/90 flex items-center justify-center p-10">
            <img src={getClientPhoto(client)!} alt="" className="max-w-full max-h-full rounded-2xl" />
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

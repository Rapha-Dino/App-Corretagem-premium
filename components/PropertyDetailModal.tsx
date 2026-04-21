'use client';

import React, { useState } from 'react';
import { 
  X, 
  User, 
  FileText, 
  Phone, 
  MessageCircle, 
  Mail, 
  MapPin, 
  Target, 
  Grid, 
  Building2, 
  Check, 
  RefreshCw, 
  Home, 
  Trees, 
  DoorOpen, 
  Maximize2, 
  Layers, 
  Calendar, 
  Trash2,
  ImageIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { supabase } from '@/lib/supabase';

// --- Helpers ---
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

const cleanPhoneNumberForWhatsApp = (phone: string) => {
  if (!phone) return "";
  let cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10 || cleaned.length === 11) {
    cleaned = "55" + cleaned;
  }
  return cleaned;
};

export function PropertyDetailModal({ property, onClose, onEdit, onRefresh }: { 
  property: any, 
  onClose: () => void, 
  onEdit: () => void, 
  onRefresh?: () => void 
}) {
  const [showZoom, setShowZoom] = useState<string | null>(null);
  const age = calculateAge(property.owner_birth_date);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[#f8fafc] rounded-[3rem] shadow-2xl w-full max-w-6xl my-8 overflow-hidden flex flex-col max-h-[95vh]"
      >
        {/* Header */}
        <div className="bg-white p-8 md:p-12 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-6">
             <div className="relative group cursor-zoom-in" onClick={() => setShowZoom(property.owner_photo_url || null)}>
                {property.owner_photo_url ? (
                  <img src={property.owner_photo_url} alt="" className="w-20 h-20 rounded-[2rem] object-cover ring-8 ring-slate-50 transition-transform group-hover:scale-105" />
                ) : (
                  <div className="w-20 h-20 rounded-[2rem] bg-blue-50 flex items-center justify-center text-blue-600 ring-8 ring-slate-50"><User className="w-10 h-10" /></div>
                )}
             </div>
             <div>
                <h3 className="text-3xl font-black text-slate-900 tracking-tight">
                  {property.owner_name} {age && <span className="text-blue-500 font-bold ml-2">({age} anos)</span>}
                </h3>
                <p className="text-[#003366] text-xs font-bold uppercase tracking-widest mt-1">Proprietário de Imóvel</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={onEdit} className="px-6 py-4 bg-slate-50 text-[#003366] rounded-2xl hover:bg-blue-50 transition-all font-bold text-xs uppercase tracking-widest flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Editar Dados
             </button>
             <button onClick={onClose} className="p-4 bg-slate-900 text-white rounded-2xl hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
                <X className="w-6 h-6" />
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-8 md:p-12 overflow-y-auto grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-5 space-y-6">
            <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm">
               <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Galeria do Imóvel</h4>
               {property.property_photos?.length > 0 ? (
                  <div className="grid grid-cols-2 gap-4">
                     {property.property_photos.map((url: string, i: number) => (
                        <div key={i} className="aspect-video relative rounded-2xl overflow-hidden group cursor-zoom-in" onClick={() => setShowZoom(url)}>
                           <img src={url} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        </div>
                     ))}
                  </div>
               ) : (
                  <div className="p-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200 text-center">
                     <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-4" />
                     <p className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest">Nenhuma foto anexada</p>
                  </div>
               )}
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm space-y-6">
              <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Contatos do Proprietário</h4>
              <div className="space-y-6">
                {property.owner_phone && (
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Phone className="w-4 h-4" /></div>
                    <div><p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">Telefone</p><p className="text-sm font-black text-slate-900">{property.owner_phone}</p></div>
                  </div>
                )}
                {property.owner_whatsapp && (
                  <div className="flex items-center justify-between group">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><MessageCircle className="w-4 h-4" /></div>
                      <div><p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">WhatsApp</p><p className="text-sm font-black text-slate-900">{property.owner_whatsapp}</p></div>
                    </div>
                    <button 
                      onClick={() => window.open(`https://wa.me/${cleanPhoneNumberForWhatsApp(property.owner_whatsapp)}`, '_blank')}
                      className="p-3 bg-emerald-600 text-white rounded-xl shadow-lg shadow-emerald-200 transition-transform group-hover:scale-110"
                    >
                      <MessageCircle className="w-4 h-4 fill-current" />
                    </button>
                  </div>
                )}
                {property.owner_email && (
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-sky-50 text-sky-600 rounded-xl"><Mail className="w-4 h-4" /></div>
                    <div><p className="text-[0.6rem] font-bold text-slate-400 uppercase tracking-widest">E-mail</p><p className="text-sm font-black text-slate-900">{property.owner_email}</p></div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-7 space-y-8">
            <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-100 shadow-sm space-y-10">
              <div className="flex flex-wrap gap-4">
                <div className="px-4 py-2 bg-blue-50 text-[#003366] rounded-xl text-[10px] font-black uppercase tracking-widest">{property.property_type}</div>
                <div className="px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest">R$ {property.sale_value?.toLocaleString('pt-BR')}</div>
                <div className="px-4 py-2 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest">Código: {property.property_code || 'S/C'}</div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-y-8 gap-x-4">
                 {[
                   { label: 'Bairro', value: property.neighborhood, icon: MapPin },
                   { label: 'Proximidades', value: property.proximity, icon: Target },
                   { label: 'Tamanho', value: `${property.total_size_m2}m²`, icon: Grid },
                   { label: 'Área Const.', value: `${property.built_area_m2}m²`, icon: Building2 },
                   { label: 'Quartos', value: property.rooms, icon: Building2 },
                   { label: 'Suítes', value: property.suites, icon: Check },
                   { label: 'Banheiros', value: property.bathrooms, icon: RefreshCw },
                   { label: 'Vagas', value: property.parking_spaces, icon: Target },
                   { label: 'IPTU', value: property.iptu ? `R$ ${property.iptu}` : 'S/I', icon: FileText },
                   { label: 'Condomínio', value: property.condo_value ? `R$ ${property.condo_value}` : 'S/I', icon: Building2 },
                   { label: 'Nome Cond.', value: property.condo_name, icon: Home },
                   { label: 'Sacada', value: property.balcony_type, icon: DoorOpen },
                   { label: 'CEP', value: property.cep, icon: MapPin },
                   { label: 'Edícula', value: property.has_edicula ? 'Sim' : 'Não', icon: Home },
                   { label: 'Quintal', value: property.has_backyard ? 'Sim' : 'Não', icon: Trees },
                   { label: 'Salas', value: property.living_rooms, icon: DoorOpen },
                   { label: 'Cozinhas', value: property.kitchens, icon: Home },
                   { label: 'Vagas (Id.)', value: property.parking_number, icon: Maximize2 },
                   { label: 'Andar/Tipo', value: property.floor_text, icon: Layers },
                   { label: 'Bloco', value: property.block, icon: Grid },
                   { label: 'Unid./Ap', value: property.unit_ap, icon: Home },
                   { label: 'Proximidade', value: property.proximity, icon: Target },
                   { label: 'Placa?', value: property.has_sign ? 'Sim' : 'Não', icon: ImageIcon },
                   { label: 'Permuta?', value: property.exchange_possible ? 'Sim' : 'Não', icon: RefreshCw },
                   { label: 'Frente (m)', value: property.front_m ? `${property.front_m}m` : '---', icon: Maximize2 },
                   { label: 'Fundo (m)', value: property.depth_m ? `${property.depth_m}m` : '---', icon: Maximize2 }
                 ].map((item, i) => (
                   <div key={i} className="space-y-1">
                      <div className="flex items-center gap-1.5 mb-1 opacity-40">
                         <item.icon className="w-3 h-3" />
                         <span className="text-[0.55rem] font-black uppercase tracking-widest">{item.label}</span>
                      </div>
                      <p className="text-[0.75rem] font-bold text-slate-900 border-b border-slate-50 pb-2">{item.value || '---'}</p>
                   </div>
                 ))}
              </div>

              <div className="space-y-3 bg-slate-50/50 p-6 rounded-3xl border border-slate-50">
                 <h4 className="text-[0.65rem] font-black text-[#003366] uppercase tracking-widest">Endereço Completo</h4>
                 <p className="text-sm font-bold text-slate-700 leading-relaxed">{property.address}</p>
              </div>

              <div className="space-y-3">
                 <h4 className="text-[0.65rem] font-black text-[#003366] uppercase tracking-widest">Observações Técnicas</h4>
                 <p className="text-sm font-medium text-slate-500 leading-relaxed italic">
                   {property.observations || 'Nenhuma observação registrada.'}
                 </p>
              </div>

              <div className="pt-10 border-t border-slate-100 flex flex-col gap-8">
                <div className="space-y-6">
                  <h4 className="text-[0.65rem] font-black text-slate-400 uppercase tracking-widest">Documentação Privada</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
                      <FileText className="w-5 h-5 text-slate-300" />
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase">CPF / RG</p><p className="text-sm font-bold text-slate-700">{property.owner_cpf_rg || 'Não informado'}</p></div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-2xl flex items-center gap-4">
                      <Calendar className="w-5 h-5 text-slate-300" />
                      <div><p className="text-[10px] font-bold text-slate-400 uppercase">Data Nascimento</p><p className="text-sm font-bold text-slate-700">{property.owner_birth_date ? format(new Date(property.owner_birth_date.includes('T') ? property.owner_birth_date : property.owner_birth_date + 'T12:00:00'), 'dd/MM/yyyy') : 'Não informado'}</p></div>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-slate-50 flex justify-end">
                  <button 
                    onClick={async () => {
                      if (confirm("Tem certeza que deseja excluir permanentemente este cadastro?")) {
                        const { error } = await supabase.from('properties').delete().eq('id', property.id);
                        if (!error) {
                          onClose();
                          if (onRefresh) onRefresh();
                        } else {
                          alert("Erro ao excluir: " + error.message);
                        }
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-4 bg-red-50 text-red-600 rounded-2xl hover:bg-red-600 hover:text-white transition-all text-xs font-black uppercase tracking-widest group shadow-sm"
                  >
                    <Trash2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    Excluir Cadastro Permanentemente
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Photo Zoom Overlay */}
      <AnimatePresence>
        {showZoom && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowZoom(null)}
            className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-4 md:p-20 cursor-zoom-out"
          >
            <motion.img 
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              src={showZoom} 
              alt="Zoom" 
              className="max-w-full max-h-full rounded-3xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

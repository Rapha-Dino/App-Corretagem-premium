'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Target, 
  Search, 
  Filter, 
  User, 
  Home, 
  MapPin, 
  Building2, 
  Car, 
  BedDouble, 
  CheckCircle2, 
  ChevronRight,
  ArrowRightLeft,
  X,
  MessageCircle,
  Phone,
  ArrowUpDown,
  Zap,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export function MatchesView({ onClientClick, onPropertyClick }: { onClientClick: (id: string) => void, onPropertyClick: (property: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  
  // Filters
  const [filterMinRooms, setFilterMinRooms] = useState<number>(0);
  const [filterMinParking, setFilterMinParking] = useState<number>(0);
  const [filterPropertyType, setFilterPropertyType] = useState<string>('Todos');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 5000000]);
  const [selectedViewClientId, setSelectedViewClientId] = useState<string>('Todos');
  
  const [selectedMatch, setSelectedMatch] = useState<any | null>(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [clientsRes, propertiesRes] = await Promise.all([
          supabase.from('clients').select('*').eq('user_id', user.id),
          supabase.from('properties').select('*').eq('user_id', user.id)
        ]);

        if (clientsRes.data) setClients(clientsRes.data);
        if (propertiesRes.data) setProperties(propertiesRes.data);
      } catch (error) {
        console.error("Error fetching match data:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const matches = useMemo(() => {
    const results: any[] = [];

    clients.forEach(client => {
      properties.forEach(property => {
        let score = 0;
        const reasons: string[] = [];

        // 1. Tipo de Imóvel (Crucial)
        const clientType = client.tipo?.toLowerCase() || '';
        const propType = property.property_type?.toLowerCase() || '';
        if (clientType && propType && (clientType === propType || propType.includes(clientType) || clientType.includes(propType))) {
          score += 40;
          reasons.push("Tipo de imóvel compatível");
        }

        // 2. Valor (Crucial)
        const clientBudget = Number(client.valor_buscado) || 0;
        const propPrice = Number(property.sale_value) || 0;
        
        if (clientBudget > 0 && propPrice > 0) {
          const diff = Math.abs(clientBudget - propPrice) / clientBudget;
          if (diff <= 0.1) { // Diferença de até 10%
            score += 30;
            reasons.push("Valor dentro do orçamento (excelente)");
          } else if (diff <= 0.2) { // Diferença de até 20%
             score += 15;
             reasons.push("Valor próximo do orçamento");
          }
        }

        // 3. Dormitórios
        const clientRooms = Number(client.dormitorios) || 0;
        const propRooms = Number(property.rooms) || 0;
        if (clientRooms > 0 && propRooms >= clientRooms) {
          score += 10;
          reasons.push(`${propRooms} quartos (atende necessidade de ${clientRooms})`);
        }

        // 4. Vagas
        const clientParking = Number(client.vagas) || 0;
        const propParking = Number(property.parking_spaces) || 0;
        if (clientParking > 0 && propParking >= clientParking) {
          score += 10;
          reasons.push(`${propParking} vagas (atende necessidade de ${clientParking})`);
        }

        // 5. Bairros
        const clientNeighborhoods = client.bairros || [];
        const propNeighborhood = property.neighborhood || '';
        if (clientNeighborhoods.length > 0 && propNeighborhood) {
          const match = clientNeighborhoods.some((b: string) => 
            b.toLowerCase().trim() === propNeighborhood.toLowerCase().trim()
          );
          if (match) {
            score += 10;
            reasons.push(`Localizado no bairro desejado: ${propNeighborhood}`);
          }
        }

        // Só exibe matches com pontuação mínima
        if (score >= 40) {
          results.push({
            id: `${client.id}-${property.id}`,
            score,
            client,
            property,
            reasons
          });
        }
      });
    });

    // Ordena por pontuação (mais forte primeiro)
    return results.sort((a, b) => b.score - a.score);
  }, [clients, properties]);

  const filteredMatches = useMemo(() => {
    return matches.filter(m => {
       const clientMatch = selectedViewClientId === 'Todos' || m.client.id === selectedViewClientId;
       const roomMatch = m.property.rooms >= filterMinRooms;
       const parkingMatch = m.property.parking_spaces >= filterMinParking;
       const typeMatch = filterPropertyType === 'Todos' || m.property.property_type === filterPropertyType;
       const priceMatch = m.property.sale_value >= priceRange[0] && m.property.sale_value <= priceRange[1];
       
       return clientMatch && roomMatch && parkingMatch && typeMatch && priceMatch;
    });
  }, [matches, selectedViewClientId, filterMinRooms, filterMinParking, filterPropertyType, priceRange]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
        <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Calculando Matches...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
             <Target className="w-8 h-8 text-blue-600" />
             Matches Inteligentes
          </h2>
          <p className="text-slate-400 text-sm mt-1">Cruzamento automático entre clientes compradores e proprietários.</p>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <div className="px-4 py-3 bg-white rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
             <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
             <span className="text-sm font-bold text-slate-700">{matches.length} Combinações Encontradas</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-6 md:p-8 rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/40 space-y-6">
        <div className="flex items-center gap-2 mb-2">
           <Filter className="w-4 h-4 text-blue-600" />
           <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Refinar Busca</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-6">
          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Buscar por Cliente</label>
             <div className="relative">
                <select 
                  value={selectedViewClientId} 
                  onChange={(e) => setSelectedViewClientId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 appearance-none"
                >
                  <option value="Todos">Todos os Clientes</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nome}</option>
                  ))}
                </select>
                <ChevronRight className="w-4 h-4 text-slate-400 absolute right-4 top-1/2 -translate-y-1/2 rotate-90 pointer-events-none" />
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Tipo de Imóvel</label>
             <select 
               value={filterPropertyType} 
               onChange={(e) => setFilterPropertyType(e.target.value)}
               className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-sm font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-100"
             >
               <option value="Todos">Todos os tipos</option>
               {['Apartamento', 'Apartamento Cobertura', 'Studio', 'Casa Térrea', 'Sobrado', 'Galpão', 'Terreno'].map(t => (
                 <option key={t} value={t}>{t}</option>
               ))}
             </select>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Quartos (Mín.)</label>
             <div className="flex gap-2">
                {[0, 1, 2, 3, 4].map(n => (
                  <button 
                    key={n}
                    onClick={() => setFilterMinRooms(n)}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${filterMinRooms === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {n === 0 ? 'Off' : `${n}+`}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Vagas (Mín.)</label>
             <div className="flex gap-2">
                {[0, 1, 2, 3].map(n => (
                  <button 
                    key={n}
                    onClick={() => setFilterMinParking(n)}
                    className={`flex-1 py-3 rounded-xl text-xs font-bold transition-all ${filterMinParking === n ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                  >
                    {n === 0 ? 'Off' : `${n}+`}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Faixa de Preço</label>
             <div className="flex items-center gap-2">
                <input 
                  type="number" 
                  placeholder="Min" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold" 
                  onChange={(e) => setPriceRange([Number(e.target.value), priceRange[1]])}
                />
                <span className="text-slate-300">-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl py-3 px-4 text-xs font-bold"
                  onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value) || 5000000])}
                />
             </div>
          </div>
        </div>
      </div>

      {/* Matches Grid */}
      {filteredMatches.length === 0 ? (
        <div className="py-20 text-center bg-white rounded-[3rem] border border-dashed border-slate-200">
           <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Zap className="w-10 h-10 text-slate-200" />
           </div>
           <h3 className="text-xl font-bold text-slate-900">Nenhum match encontrado</h3>
           <p className="text-slate-400 max-w-xs mx-auto text-sm mt-2">Ajuste os filtros acima para encontrar combinações entre seus leads e imóveis.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          {filteredMatches.map((match) => (
             <motion.div 
               key={match.id}
               initial={{ opacity: 0, x: -20 }}
               animate={{ opacity: 1, x: 0 }}
               className="group relative"
             >
                <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/30 overflow-hidden hover:border-blue-200 transition-all">
                   <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-slate-50">
                      
                      {/* Lado do Cliente (Lead) */}
                      <div className="flex-1 p-8 bg-slate-50/30">
                         <div className="flex items-start justify-between mb-6">
                            <div 
                              className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => onClientClick(match.client.id)}
                            >
                               <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-100">
                                  <User className="w-7 h-7" />
                               </div>
                               <div>
                                  <h4 className="text-lg font-black text-slate-900">{match.client.nome}</h4>
                                  <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest px-2 py-1 bg-blue-50 rounded-lg">Cliente Comprador</span>
                               </div>
                            </div>
                            <div className="flex gap-2">
                               <button className="p-3 bg-white rounded-xl text-emerald-500 hover:bg-emerald-50 transition-all border border-slate-100 shadow-sm">
                                  <Phone className="w-4 h-4" />
                               </button>
                               <button className="p-3 bg-white rounded-xl text-blue-500 hover:bg-blue-50 transition-all border border-slate-100 shadow-sm">
                                  <MessageCircle className="w-4 h-4" />
                               </button>
                            </div>
                         </div>
                         
                         <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-white pb-3">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Busca Imóvel Tipo</span>
                               <span className="text-sm font-bold text-slate-700">{match.client.tipo || '---'}</span>
                            </div>
                            <div className="flex justify-between items-end border-b border-white pb-3">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Orçamento Máximo</span>
                               <span className="text-sm font-black text-emerald-600">R$ {match.client.valor_buscado?.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="flex flex-wrap gap-2 pt-2">
                               {match.client.bairros?.slice(0, 3).map((b: string) => (
                                 <span key={b} className="px-3 py-1 bg-white border border-slate-100 text-[10px] font-bold text-slate-500 rounded-full">{b}</span>
                               ))}
                            </div>
                         </div>
                      </div>

                      {/* Divisor Visual do Match */}
                      <div className="flex items-center justify-center py-4 lg:py-0 px-10 relative bg-white overflow-hidden">
                         <div className="absolute top-0 bottom-0 left-1/2 w-px bg-slate-50 hidden lg:block" />
                         <div className="flex flex-col items-center gap-3 relative z-10">
                            <div className="w-12 h-12 bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 border-4 border-white">
                               <Star className="w-5 h-5 fill-white" />
                            </div>
                            <div className="text-center">
                               <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">{match.score}% Compatível</span>
                               <p className="text-[9px] font-bold text-slate-400 mt-1">Sugerido por IA</p>
                            </div>
                            <ArrowRightLeft className="w-4 h-4 text-slate-200 mt-2" />
                         </div>
                      </div>

                      {/* Lado do Imóvel (Property) */}
                      <div className="flex-1 p-8 bg-emerald-50/10">
                         <div className="flex items-start justify-between mb-6">
                            <div 
                              className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => onPropertyClick(match.property)}
                            >
                               <div className="w-14 h-14 bg-white border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-500 shadow-sm">
                                  <Home className="w-7 h-7" />
                               </div>
                               <div className="max-w-[200px]">
                                  <h4 className="text-lg font-black text-slate-900 truncate">{match.property.address}</h4>
                                  <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest px-2 py-1 bg-emerald-50 rounded-lg">{match.property.property_type}</span>
                               </div>
                            </div>
                            <div 
                              className="p-3 bg-white rounded-xl text-blue-600 border border-emerald-50 shadow-sm font-black text-[10px] cursor-pointer hover:bg-slate-50"
                              onClick={() => onPropertyClick(match.property)}
                            >
                               ID: {match.property.property_code || 'S/C'}
                            </div>
                         </div>

                         <div className="space-y-4">
                            <div className="flex justify-between items-end border-b border-emerald-50/50 pb-3">
                               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor de Venda</span>
                               <span className="text-sm font-black text-slate-900">R$ {match.property.sale_value?.toLocaleString('pt-BR')}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-4 pt-2">
                               <div className="text-center p-2 bg-white rounded-xl border border-emerald-50">
                                  <BedDouble className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                                  <p className="text-[10px] font-black">{match.property.rooms} Qts</p>
                               </div>
                               <div className="text-center p-2 bg-white rounded-xl border border-emerald-50">
                                  <Car className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                                  <p className="text-[10px] font-black">{match.property.parking_spaces} Vagas</p>
                               </div>
                               <div className="text-center p-2 bg-white rounded-xl border border-emerald-50">
                                  <Building2 className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                                  <p className="text-[10px] font-black">{match.property.total_size_m2}m²</p>
                               </div>
                            </div>
                         </div>
                      </div>
                   </div>

                   {/* Footer do Match Card - Motivos do Match */}
                   <div className="px-8 py-4 bg-slate-900 flex flex-col md:flex-row justify-between items-center gap-4 transition-all group-hover:bg-blue-600">
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                         {match.reasons.slice(0, 3).map((r: string, idx: number) => (
                           <div key={idx} className="flex items-center gap-2">
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                              <span className="text-[9px] font-black text-white uppercase tracking-widest">{r}</span>
                           </div>
                         ))}
                      </div>
                      <button 
                        onClick={() => setSelectedMatch(match)}
                        className="w-full md:w-auto px-6 py-2 bg-white/10 hover:bg-white text-white hover:text-blue-600 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                      >
                         Gerar Proposta
                         <ChevronRight className="w-3 h-3" />
                      </button>
                   </div>
                </div>
             </motion.div>
          ))}
        </div>
      )}

      {/* Proposal/Detail Overlay */}
      <AnimatePresence>
         {selectedMatch && (
           <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-[3rem] shadow-2xl w-full max-w-4xl p-10 relative overflow-hidden"
              >
                 <button 
                   onClick={() => setSelectedMatch(null)}
                   className="absolute top-8 right-8 p-3 bg-slate-50 text-slate-400 hover:text-slate-600 rounded-2xl transition-all"
                 >
                    <X className="w-6 h-6" />
                 </button>

                 <div className="flex items-center gap-4 mb-10">
                    <div className="w-16 h-16 bg-blue-600 text-white rounded-[1.5rem] flex items-center justify-center">
                       <ArrowRightLeft className="w-8 h-8" />
                    </div>
                    <div>
                       <h3 className="text-2xl font-black text-slate-900 tracking-tight">Oportunidade de Negócio</h3>
                       <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">Conectando Proprietário {selectedMatch.property.owner_name} ao Lead {selectedMatch.client.nome}</p>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="space-y-6">
                       <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Próximos Passos</h4>
                       <div className="space-y-4">
                          {[
                            "Ligar para o Lead apresentando as vantagens deste imóvel",
                            "Agendar visita para os próximos 3 dias",
                            "Preparar dossiê técnico do imóvel com as fotos cadastradas",
                            "Validar margem de negociação com o proprietário"
                          ].map((step, i) => (
                            <div key={i} className="flex gap-4 items-start p-4 bg-slate-50 rounded-2xl border border-slate-100">
                               <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-black">{i+1}</div>
                               <p className="text-sm font-bold text-slate-700">{step}</p>
                            </div>
                          ))}
                       </div>
                    </div>

                    <div className="bg-slate-900 rounded-[2rem] p-8 text-white flex flex-col justify-between">
                       <div>
                          <div className="flex items-center gap-3 mb-6">
                             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                             <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Score de Conversão: {selectedMatch.score}%</span>
                          </div>
                          <p className="text-lg font-bold text-slate-300 leading-relaxed italic">
                             "Este imóvel atende perfeitamente aos critérios de {selectedMatch.client.dormitorios} quartos e orçamento de R$ {selectedMatch.client.valor_buscado?.toLocaleString('pt-BR')} do cliente {selectedMatch.client.nome}."
                          </p>
                       </div>
                       
                       <div className="space-y-3 mt-10">
                          <button className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-3">
                             <MessageCircle className="w-4 h-4 fill-current" />
                             Enviar pelo WhatsApp
                          </button>
                          <button className="w-full py-4 bg-white/10 hover:bg-white/20 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                             Adicionar ao Histórico
                          </button>
                       </div>
                    </div>
                 </div>
              </motion.div>
           </div>
         )}
      </AnimatePresence>
    </div>
  );
}

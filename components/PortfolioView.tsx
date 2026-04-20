'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Upload, 
  MapPin, 
  Home, 
  Building2, 
  Target, 
  Phone, 
  MessageCircle, 
  Mail, 
  User, 
  ImageIcon, 
  Grid, 
  RefreshCw,
  FileText,
  Calendar,
  Check,
  Trash2,
  Camera,
  Trees,
  X,
  Maximize2,
  Layers,
  DoorOpen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import Papa from 'papaparse';
import { supabase } from '@/lib/supabase';

import { PropertyDetailModal } from './PropertyDetailModal';

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

const parseBRDateToISO = (dateStr: string | null) => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  
  // Se já estiver no formato ISO (AAAA-MM-DD), retorna
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) return dateStr;

  // Tenta formato brasileiro DD/MM/AAAA
  const parts = dateStr.split(/[/.-]/); // Suporta /, . ou - como separador
  if (parts.length === 3) {
    let day, month, year;
    if (parts[0].length === 4) { // AAAA/MM/DD
      [year, month, day] = parts;
    } else { // DD/MM/AAAA
      [day, month, year] = parts;
    }
    
    // Normaliza partes (ex: remove espaços)
    year = year.trim();
    month = month.trim().padStart(2, '0');
    day = day.trim().padStart(2, '0');

    if (year.length === 4 && month.length === 2 && day.length === 2) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
};

export function PortfolioView({ onRefresh }: { onRefresh: () => void }) {
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('Todos');
  const [filterProximity, setFilterProximity] = useState('Todos');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [showDetail, setShowDetail] = useState<any>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchProperties = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('relation "properties" does not exist')) {
          console.warn("Properties table does not exist. Please create it in Supabase.");
          setProperties([]);
        } else {
          throw error;
        }
      } else {
        setProperties(data || []);
      }
    } catch (err: any) {
      console.error("Error fetching properties:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const filteredProperties = useMemo(() => {
    return properties.filter(prop => {
      const matchesSearch = !searchTerm || 
        (prop.address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prop.owner_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (prop.neighborhood || '').toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesType = filterType === 'Todos' || prop.property_type === filterType;
      const matchesProximity = filterProximity === 'Todos' || (prop.proximity || '').includes(filterProximity);

      return matchesSearch && matchesType && matchesProximity;
    });
  }, [properties, searchTerm, filterType, filterProximity]);

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("Iniciando importação de:", file.name);
    setIsImporting(true);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      delimiter: "", // Auto-detect delimiter (handles comma, semicolon, etc.)
      complete: async (results) => {
        console.log("CSV Parsed. Linhas encontradas:", results.data.length);
        if (results.errors.length > 0) {
          console.warn("Erros detectados no Parse:", results.errors);
        }
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) throw new Error("Usuário não autenticado");

          const imported = results.data.map((row: any, index) => {
            const normalized: any = {};
            Object.keys(row).forEach(key => {
              const k = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, '');
              normalized[k] = row[key];
            });

            if (index === 0) {
              console.log("DEBUG CSV - Primeira Linha Original:", row);
              console.log("DEBUG CSV - Chaves Normalizadas:", Object.keys(normalized));
            }

            const fuzzyAddress = Object.entries(row).find(([k, v]) => {
              const nk = k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              const val = String(v || '').toLowerCase();
              return nk.includes('endereco') || nk.includes('rua') || nk.includes('logradouro') || nk.includes('localizacao') || 
                     val.startsWith('rua ') || val.startsWith('av ') || val.startsWith('avenida ');
            })?.[1];

            const fuzzyObservations = Object.entries(row).find(([k]) => {
              const nk = k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return nk.includes('obs') || nk.includes('detalhe') || nk.includes('comentario') || nk.includes('informacao') || nk.includes('observacoes');
            })?.[1];

            const fuzzyDepth = Object.entries(row).find(([k]) => {
              const nk = k.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
              return nk.includes('fundo') || nk.includes('profundidade');
            })?.[1];

            const addr = normalized.enderecocompleto || normalized.endereco || normalized.rua || normalized.logradouro || normalized.enderecodooimovel || normalized.enderecodaimovel || normalized.localizacao || normalized.ruacompleta || normalized.descrendereco || normalized.enderecodooimovelcompleto || normalized.enderecodoimovel || normalized.nomedarua || normalized.fulladdress || String(fuzzyAddress || '');

            if (index === 0 && !addr) {
              console.warn("ALERTA: Endereço não detectado na primeira linha. Chaves disponíveis:", Object.keys(normalized));
            }

            return {
              user_id: user.id,
              owner_name: String(normalized.nome || normalized.proprietario || normalized.owner || String(fallbackName)).substring(0, 100),
              owner_phone: normalized.telefone || normalized.phone || '',
              owner_whatsapp: normalized.whatsapp || normalized.celular || '',
              owner_email: normalized.email || '',
              owner_cpf_rg: normalized.documento || normalized.cpf || normalized.rg || '',
              owner_birth_date: parseBRDateToISO(normalized.nascimento || normalized.datanascimento),
              address: addr,
              neighborhood: normalized.bairro || normalized.vizinhanca || normalized.distrito || '',
              cep: normalized.cep || normalized.codigopostal || normalized.cepimovel || '',
              sale_value: Number(String(normalized.valor || normalized.preco || normalized.valorvenda || normalized.valordevenda || normalized.valorvendas || normalized.precodevenda || '0').replace(/[^\d]/g, '')) || 0,
              property_type: normalized.tipo || normalized.categoria || normalized.tipoimovel || 'Casa',
              rooms: Number(String(normalized.quartos || normalized.dormitorios || normalized.qtdquartos || 0).replace(',', '.')),
              bathrooms: Number(String(normalized.banheiro || normalized.wc || normalized.banheiros || 0).replace(',', '.')),
              suites: Number(String(normalized.suites || 0).replace(',', '.')),
              kitchens: Number(String(normalized.cozinhas || normalized.cozinha || 0).replace(',', '.')),
              front_m: Number(String(normalized.frente || normalized.metragemfrente || normalized.frentem || normalized.medidafrente || 0).replace(',', '.')),
              depth_m: Number(String(normalized.fundo || normalized.fundos || normalized.metragemfundo || normalized.fundom || normalized.medidafundo || normalized.medidafundos || normalized.profundidade || fuzzyDepth || 0).replace(',', '.')),
              total_size_m2: Number(String(normalized.tamanho || normalized.area || normalized.metragem || normalized.area_total || normalized.at || normalized.aream2 || 0).replace(',', '.')),
              built_area_m2: Number(String(normalized.areaconstruida || normalized.area_util || normalized.ac || normalized.const || 0).replace(',', '.')),
              property_code: normalized.codigo || normalized.ref || normalized.id_imovel || normalized.referencia || normalized.codimovel || '',
              has_edicula: String(normalized.edicula || normalized.temedicula || '0').toLowerCase().trim() === '1' || String(normalized.edicula || normalized.temedicula || '').toLowerCase().trim() === 'sim' || String(normalized.edicula || normalized.temedicula || '').toLowerCase().trim() === 'true',
              has_backyard: String(normalized.quintal || normalized.temquintal || '0').toLowerCase().trim() === '1' || String(normalized.quintal || normalized.temquintal || '').toLowerCase().trim() === 'sim' || String(normalized.quintal || normalized.temquintal || '').toLowerCase().trim() === 'true',
              has_sign: String(normalized.placa || normalized.templaca || '0').toLowerCase().trim() === '1' || String(normalized.placa || normalized.templaca || '').toLowerCase().trim() === 'sim' || String(normalized.placa || normalized.templaca || '').toLowerCase().trim() === 'true',
              exchange_possible: String(normalized.permuta || normalized.aceitapermuta || '0').toLowerCase().trim() === '1' || String(normalized.permuta || normalized.aceitapermuta || '').toLowerCase().trim() === 'sim' || String(normalized.permuta || normalized.aceitapermuta || '').toLowerCase().trim() === 'true',
              observations: normalized.observacoes || normalized.observacao || normalized.obs || normalized.detalhes || normalized.informacoesadicionais || normalized.comentarios || String(fuzzyObservations || ''),
              data_entrada: parseBRDateToISO(normalized.data || normalized.data_entrada) || new Date().toISOString().split('T')[0]
            };
          });

          console.log("Dados mapeados. Tentando inserir no Supabase:", imported.length, "registros");

          if (imported.length === 0) throw new Error("Arquivo CSV parece estar vazio ou sem colunas válidas.");

          const { error } = await supabase.from('properties').insert(imported);
          
          if (error) {
            console.error("Erro Supabase na inserção:", error);
            if (error.message.includes('relation "properties" does not exist')) {
              throw new Error("A tabela 'properties' ainda não existe ou não foi encontrada. Verifique se o nome está correto no Supabase.");
            }
            throw new Error(`Erro no banco de dados: ${error.message} - Verifique se os nomes das colunas estão corretos.`);
          }
          
          alert(`Sucesso! ${imported.length} imóveis foram importados.`);
          fetchProperties();
          if (onRefresh) onRefresh();
        } catch (err: any) {
          console.error("Erro completo na importação:", err);
          alert("Erro na importação: " + (err.message || "Verifique o console para mais detalhes."));
        } finally {
          setIsImporting(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      },
      error: (err) => {
        console.error("Erro no Papa.parse:", err);
        alert("Falha ao ler o arquivo CSV. Certifique-se de que é um arquivo válido.");
        setIsImporting(false);
      }
    });
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header com Layout Reorganizado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="flex-1">
          <h3 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Proprietários & Imóveis</h3>
          <div className="flex items-center gap-3">
            <p className="text-[#003366] text-xs font-bold uppercase tracking-widest">Gestão de Carteira e Captação</p>
            <div className="h-4 w-px bg-slate-200" />
            
            {/* Botão de Importar CSV - Menor e no canto */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportCSV} 
              accept=".csv" 
              className="hidden" 
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              title="Importar Imóveis de arquivo CSV"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg text-[10px] font-black uppercase text-slate-400 hover:text-blue-600 hover:bg-white hover:border-blue-100 transition-all group"
            >
              <Upload className="w-3 h-3 group-hover:scale-110 transition-transform" />
              {isImporting ? 'Importando...' : 'Importar CSV'}
            </button>
          </div>
        </div>

        {/* Botão Novo Imóvel - Mais destaque e centralizado no fluxo visual */}
        <div className="flex items-center justify-center w-full md:w-auto">
          <button 
            onClick={() => { setSelectedProperty(null); setIsModalOpen(true); }}
            className="flex items-center justify-center gap-3 px-10 py-4 bg-blue-600 text-white rounded-[1.5rem] text-sm font-black uppercase tracking-wider hover:bg-blue-700 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-xl shadow-blue-200 group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400/0 via-white/10 to-blue-400/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
            <Plus className="w-5 h-5" />
            Novo Imóvel
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 bg-white p-4 rounded-[2rem] border border-slate-100 shadow-sm">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder="Buscar por rua ou proprietário..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-3 pl-10 pr-4 text-xs font-bold text-slate-700 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
          />
        </div>

        <select 
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer"
        >
          <option value="Todos">Todos os Tipos</option>
          {['Apartamento', 'Apartamento Cobertura', 'Apartamento Duplex', 'Studio', 'Casa Térrea', 'Casa em Condomínio', 'Casa em Vila', 'Sobrado', 'Galpão', 'Terreno', 'Prédio Comercial', 'Sala Comercial', 'Chácara', 'Sítio', 'Fazenda'].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select 
          value={filterProximity}
          onChange={(e) => setFilterProximity(e.target.value)}
          className="bg-slate-50 border border-slate-100 rounded-2xl py-3 px-4 text-xs font-bold text-slate-700 focus:ring-4 focus:ring-blue-50 outline-none transition-all cursor-pointer"
        >
          <option value="Todos">Todas as Proximidades</option>
          <option value="Metrô">Metrô</option>
          <option value="Shopping">Shopping</option>
          <option value="Hospital">Hospital</option>
          <option value="N/A">N/A</option>
        </select>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-10 h-10 text-blue-100 animate-spin" />
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">Carregando Imóveis...</p>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="bg-white rounded-[3rem] p-20 border border-dashed border-slate-200 text-center">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
            <Home className="w-10 h-10 text-slate-300" />
          </div>
          <h4 className="text-xl font-bold text-slate-900 mb-2">Nenhum imóvel encontrado</h4>
          <p className="text-slate-400 max-w-md mx-auto text-sm">
            Tente ajustar seus filtros ou cadastre seu primeiro proprietário e imóvel no botão acima.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map(prop => (
            <OwnerPropertyCard 
              key={prop.id} 
              property={prop} 
              onClick={() => setShowDetail(prop)}
            />
          ))}
        </div>
      )}

      {isModalOpen && (
        <PropertyModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)}
          initialData={selectedProperty}
          onSuccess={() => { fetchProperties(); onRefresh(); }}
        />
      )}

      {showDetail && (
        <PropertyDetailModal 
          property={showDetail}
          onClose={() => setShowDetail(null)}
          onEdit={() => { setSelectedProperty(showDetail); setShowDetail(null); setIsModalOpen(true); }}
          onRefresh={fetchProperties}
        />
      )}
    </div>
  );
}

function OwnerPropertyCard({ property, onClick }: { property: any, onClick: () => void }) {
  const age = calculateAge(property.owner_birth_date);
  
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      onClick={onClick}
      className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all cursor-pointer overflow-hidden group"
    >
      <div className="relative h-48 overflow-hidden bg-slate-100">
        {property.property_photos?.[0] ? (
          <img 
            src={property.property_photos[0]} 
            alt="Imóvel" 
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-slate-300 gap-2">
            <ImageIcon className="w-10 h-10" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sem fotos</span>
          </div>
        )}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-[10px] font-black text-[#003366] uppercase tracking-widest shadow-sm">
            {property.property_type || 'N/A'}
          </span>
        </div>
      </div>

      <div className="p-6 md:p-8">
        <div className="flex items-center gap-4 mb-6">
          {property.owner_photo_url ? (
            <img src={property.owner_photo_url} alt="" className="w-12 h-12 rounded-2xl object-cover ring-4 ring-slate-50" />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 ring-4 ring-slate-50">
              <User className="w-6 h-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-black text-slate-900 leading-tight truncate">
              {property.owner_name} {age && <span className="text-blue-500 ml-1">({age})</span>}
            </h4>
            <p className="text-[0.6rem] font-bold text-slate-400 mt-0.5 uppercase tracking-widest">Proprietário(a)</p>
          </div>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-2">
            <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
            <p className="text-xs font-bold text-slate-600 line-clamp-2">{property.address || 'Endereço não informado'}</p>
          </div>
          <div className="flex justify-between items-end border-t border-slate-50 pt-4">
            <div>
              <p className="text-[0.55rem] font-bold text-[#003366] uppercase tracking-widest mb-1">Valor Venda</p>
              <p className="text-lg font-black text-slate-900">
                R$ {property.sale_value ? property.sale_value.toLocaleString('pt-BR') : '---'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[0.55rem] font-bold text-slate-400 uppercase tracking-widest">Código</p>
                <p className="text-xs font-black text-[#003366]">{property.property_code || 'S/C'}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 text-slate-400 border-t border-slate-50 pt-4">
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            <Building2 className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">{property.rooms || 0}</span>
          </div>
          <div className="flex items-center gap-1.5 grayscale opacity-50">
            <Target className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold">{property.total_size_m2 || 0}m²</span>
          </div>
          <div className="flex items-center gap-1.5 grayscale opacity-50 ml-auto">
            <Phone className="w-3.5 h-3.5" />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function PropertyModal({ isOpen, onClose, initialData, onSuccess }: { isOpen: boolean, onClose: () => void, initialData?: any, onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    owner_name: '',
    owner_phone: '',
    owner_whatsapp: '',
    owner_email: '',
    owner_cpf_rg: '',
    owner_birth_date: '',
    owner_photo_url: '',
    address: '',
    neighborhood: '',
    cep: '',
    sale_value: '',
    proximity: 'N/A',
    front_m: '',
    depth_m: '',
    total_size_m2: '',
    built_area_m2: '',
    property_type: 'Casa',
    unit_ap: '',
    block: '',
    iptu: '',
    property_code: '',
    floor_text: '',
    parking_spaces: '',
    parking_number: '',
    has_backyard: false,
    has_edicula: false,
    rooms: '',
    living_rooms: '',
    kitchens: '',
    balcony_type: 'Nenhuma',
    suites: '',
    bathrooms: '',
    has_sign: false,
    exchange_possible: false,
    observations: '',
    property_photos: [] as string[],
    data_entrada: format(new Date(), 'yyyy-MM-dd')
  });

  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        owner_name: initialData.owner_name || '',
        owner_phone: initialData.owner_phone || '',
        owner_whatsapp: initialData.owner_whatsapp || '',
        owner_email: initialData.owner_email || '',
        owner_cpf_rg: initialData.owner_cpf_rg || '',
        owner_birth_date: initialData.owner_birth_date || '',
        owner_photo_url: initialData.owner_photo_url || '',
        address: initialData.address || '',
        neighborhood: initialData.neighborhood || '',
        cep: initialData.cep || '',
        sale_value: initialData.sale_value?.toString() || '',
        proximity: initialData.proximity || 'N/A',
        front_m: initialData.front_m?.toString() || '',
        depth_m: initialData.depth_m?.toString() || '',
        total_size_m2: initialData.total_size_m2?.toString() || '',
        built_area_m2: initialData.built_area_m2?.toString() || '',
        property_type: initialData.property_type || 'Casa',
        unit_ap: initialData.unit_ap || '',
        block: initialData.block || '',
        iptu: initialData.iptu?.toString() || '',
        property_code: initialData.property_code || '',
        floor_text: initialData.floor_text || '',
        parking_spaces: initialData.parking_spaces?.toString() || '',
        parking_number: initialData.parking_number || '',
        has_backyard: !!initialData.has_backyard,
        has_edicula: !!initialData.has_edicula,
        rooms: initialData.rooms?.toString() || '',
        living_rooms: initialData.living_rooms?.toString() || '',
        kitchens: initialData.kitchens?.toString() || '',
        balcony_type: initialData.balcony_type || 'Nenhuma',
        suites: initialData.suites?.toString() || '',
        bathrooms: initialData.bathrooms?.toString() || '',
        has_sign: !!initialData.has_sign,
        exchange_possible: !!initialData.exchange_possible,
        observations: initialData.observations || '',
        property_photos: initialData.property_photos || [],
        data_entrada: initialData.data_entrada || format(new Date(), 'yyyy-MM-dd')
      });
    }
  }, [initialData]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPhotos = [...formData.property_photos];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `properties/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('properties')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
          .from('properties')
          .getPublicUrl(filePath);

        newPhotos.push(data.publicUrl);
      }

      setFormData({ ...formData, property_photos: newPhotos });
    } catch (err: any) {
      alert("Erro ao enviar fotos: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index: number) => {
    const newPhotos = formData.property_photos.filter((_, i) => i !== index);
    setFormData({ ...formData, property_photos: newPhotos });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const payload = {
        ...formData,
        user_id: user.id,
        sale_value: Number(formData.sale_value) || 0,
        front_m: Number(formData.front_m) || 0,
        depth_m: Number(formData.depth_m) || 0,
        total_size_m2: Number(formData.total_size_m2) || 0,
        built_area_m2: Number(formData.built_area_m2) || 0,
        iptu: Number(formData.iptu) || 0,
        parking_spaces: Number(formData.parking_spaces) || 0,
        rooms: Number(formData.rooms) || 0,
        living_rooms: Number(formData.living_rooms) || 0,
        kitchens: Number(formData.kitchens) || 1,
        suites: Number(formData.suites) || 0,
        bathrooms: Number(formData.bathrooms) || 0,
        updated_at: new Date().toISOString()
      };

      let result;
      if (initialData) {
        result = await supabase.from('properties').update(payload).eq('id', initialData.id);
      } else {
        result = await supabase.from('properties').insert([payload]);
      }

      if (result.error) throw result.error;
      onSuccess();
      onClose();
    } catch (err: any) {
      alert("Erro ao salvar imóvel: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-5xl my-8 overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
          <h3 className="text-2xl font-black text-slate-900">Cadastro de Proprietário e Imóvel</h3>
          <button onClick={onClose} className="p-3 bg-slate-50 text-slate-400 rounded-2xl"><Plus className="w-6 h-6 rotate-45" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 md:p-12 overflow-y-auto space-y-12">
          {/* Owner Data */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-blue-600 rounded-full" />
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Dados do Proprietário</h4>
            </div>

            <div className="flex flex-col md:flex-row gap-8 items-start">
               <div className="space-y-4">
                  <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Foto do Proprietário</label>
                  <label className="w-32 h-32 rounded-[2rem] bg-slate-50 border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-all overflow-hidden relative group">
                     {formData.owner_photo_url ? (
                        <>
                           <img src={formData.owner_photo_url} alt="" className="w-full h-full object-cover" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                              <Camera className="w-6 h-6 text-white" />
                           </div>
                        </>
                     ) : (
                        <>
                           <Camera className="w-8 h-8 text-slate-300" />
                           <span className="text-[8px] font-black uppercase text-slate-400 mt-2">Upload</span>
                        </>
                     )}
                     <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setLoading(true);
                        try {
                           const fileExt = file.name.split('.').pop();
                           const fileName = `${Math.random()}.${fileExt}`;
                           const filePath = `owners/${fileName}`;
                           await supabase.storage.from('properties').upload(filePath, file);
                           const { data } = supabase.storage.from('properties').getPublicUrl(filePath);
                           setFormData({ ...formData, owner_photo_url: data.publicUrl });
                        } catch (err) {
                           console.error(err);
                        } finally {
                           setLoading(false);
                        }
                     }} />
                  </label>
               </div>

               <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input required value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Data Cadastro</label>
                    <input type="date" value={formData.data_entrada} onChange={e => setFormData({...formData, data_entrada: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">CPF / RG</label>
                    <input value={formData.owner_cpf_rg} onChange={e => setFormData({...formData, owner_cpf_rg: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Telefone</label>
                    <input value={formData.owner_phone} onChange={e => setFormData({...formData, owner_phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">WhatsApp</label>
                    <input value={formData.owner_whatsapp} onChange={e => setFormData({...formData, owner_whatsapp: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">E-mail</label>
                <input type="email" value={formData.owner_email} onChange={e => setFormData({...formData, owner_email: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Data Nascimento</label>
                <input type="date" value={formData.owner_birth_date} onChange={e => setFormData({...formData, owner_birth_date: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
            </div>
          </section>

          {/* Property Data */}
          <section className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-emerald-600 rounded-full" />
              <h4 className="text-lg font-black text-slate-900 uppercase tracking-tighter">Dados do Imóvel</h4>
            </div>

            {/* Photo Gallery Upload */}
            <div className="space-y-4">
              <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Fotos do Imóvel</label>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {formData.property_photos.map((url, i) => (
                  <div key={i} className="aspect-square relative rounded-2xl overflow-hidden group border border-slate-100">
                    <img src={url} alt="" className="w-full h-full object-cover" />
                    <button 
                      type="button"
                      onClick={() => removePhoto(i)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <label className={`aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-all ${uploading ? 'opacity-50 pointer-events-none' : ''}`}>
                  {uploading ? (
                    <RefreshCw className="w-6 h-6 text-blue-500 animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-6 h-6 text-slate-400" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">Adicionar</span>
                    </>
                  )}
                  <input type="file" multiple accept="image/*" onChange={handlePhotoUpload} className="hidden" />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-2 space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Endereço Completo</label>
                <input value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Bairro</label>
                <input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">CEP</label>
                <input value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Valor Venda (R$)</label>
                <input type="number" required value={formData.sale_value} onChange={e => setFormData({...formData, sale_value: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Proximidades</label>
                <select value={formData.proximity} onChange={e => setFormData({...formData, proximity: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold cursor-pointer">
                  <option value="N/A">N/A</option>
                  <option value="Metrô">Metrô</option>
                  <option value="Shopping">Shopping</option>
                  <option value="Hospital">Hospital</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Tipo Imóvel</label>
                <select value={formData.property_type} onChange={e => setFormData({...formData, property_type: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold cursor-pointer">
                  {['Apartamento', 'Apartamento Cobertura', 'Apartamento Duplex', 'Studio', 'Casa Térrea', 'Casa em Condomínio', 'Casa em Vila', 'Sobrado', 'Galpão', 'Terreno', 'Prédio Comercial', 'Sala Comercial', 'Chácara', 'Sítio', 'Fazenda'].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Código</label>
                <input value={formData.property_code} onChange={e => setFormData({...formData, property_code: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Tamanho (m²)</label>
                <input type="number" value={formData.total_size_m2} onChange={e => setFormData({...formData, total_size_m2: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Área Const. (m²)</label>
                <input type="number" value={formData.built_area_m2} onChange={e => setFormData({...formData, built_area_m2: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Frente (m)</label>
                <input type="number" value={formData.front_m} onChange={e => setFormData({...formData, front_m: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Fundos (m)</label>
                <input type="number" value={formData.depth_m} onChange={e => setFormData({...formData, depth_m: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Quartos</label>
                <input type="number" value={formData.rooms} onChange={e => setFormData({...formData, rooms: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Suítes</label>
                <input type="number" value={formData.suites} onChange={e => setFormData({...formData, suites: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Banheiros (WC)</label>
                <input type="number" value={formData.bathrooms} onChange={e => setFormData({...formData, bathrooms: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Salas</label>
                <input type="number" value={formData.living_rooms} onChange={e => setFormData({...formData, living_rooms: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Cozinhas</label>
                <input type="number" value={formData.kitchens} onChange={e => setFormData({...formData, kitchens: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Vagas</label>
                <input type="number" value={formData.parking_spaces} onChange={e => setFormData({...formData, parking_spaces: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>

              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Andar (Info Texto)</label>
                <input value={formData.floor_text} onChange={e => setFormData({...formData, floor_text: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold" />
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Placa?</label>
                <select value={formData.has_sign ? 'sim' : 'não'} onChange={e => setFormData({...formData, has_sign: e.target.value === 'sim'})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold cursor-pointer">
                  <option value="não">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Permuta?</label>
                <select value={formData.exchange_possible ? 'sim' : 'não'} onChange={e => setFormData({...formData, exchange_possible: e.target.value === 'sim'})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold cursor-pointer">
                  <option value="não">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Edícula?</label>
                <select value={formData.has_edicula ? 'sim' : 'não'} onChange={e => setFormData({...formData, has_edicula: e.target.value === 'sim'})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold cursor-pointer">
                  <option value="não">Não</option>
                  <option value="sim">Sim</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[0.65rem] font-bold text-slate-400 uppercase tracking-widest ml-1">Observações</label>
              <textarea value={formData.observations} onChange={e => setFormData({...formData, observations: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-4 px-5 text-sm font-bold min-h-[100px]" />
            </div>
          </section>

          <footer className="sticky bottom-0 bg-white pt-6 border-t border-slate-50 flex justify-end gap-4">
            <button type="button" onClick={onClose} className="px-10 py-4 text-slate-400 font-bold hover:text-slate-600 transition-all">Cancelar</button>
            <button type="submit" disabled={loading} className="px-16 py-4 bg-slate-900 text-white rounded-2xl font-bold hover:scale-[1.02] transition-all shadow-xl shadow-slate-900/20 disabled:opacity-50">
              {loading ? 'Salvando...' : initialData ? 'Salvar Alterações' : 'Cadastrar Imóvel'}
            </button>
          </footer>
        </form>
      </motion.div>
    </div>
  );
}

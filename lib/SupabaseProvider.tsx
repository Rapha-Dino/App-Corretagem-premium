'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { User } from '@supabase/supabase-js';

interface SupabaseContextType {
  user: User | null;
  profile: any | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
}

const SupabaseContext = createContext<SupabaseContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export const useSupabase = () => useContext(SupabaseContext);

export const SupabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [envError, setEnvError] = useState<string | null>(null);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      if (error && error.code === 'PGRST116') {
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert([
              { 
                id: userId, 
                name: userData.user.user_metadata.full_name || userData.user.email?.split('@')[0] || 'Novo Usuário',
                email: userData.user.email,
                role: (userData.user.email === 'rafaandouni@gmail.com' || userData.user.email === 'rogerio.diniz@hotmail.com' || userData.user.email === 'raphaell_diniz@hotmail.com' || userData.user.email === 'mariapzuba@gmail.com') ? 'admin' : 'corretor'
              }
            ])
            .select()
            .single();
          
          if (createError) {
            console.error('Error creating profile:', createError);
            setEnvError(`Erro ao criar perfil no Supabase: ${createError.message}. Verifique as políticas de RLS.`);
          } else {
            setProfile(newProfile);
          }
        }
      } else if (error) {
        console.error('Error fetching profile:', error);
        setEnvError(`Erro ao buscar perfil: ${error.message}`);
      } else {
        setProfile(data);
      }
    } catch (err: any) {
      console.error('Unexpected error in fetchProfile:', err);
      setEnvError(`Erro inesperado no perfil: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    // Check for missing environment variables
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey || supabaseUrl === '' || supabaseAnonKey === '' || supabaseUrl === 'https://placeholder.supabase.co') {
      setEnvError("Configuração do Supabase ausente ou inválida. Verifique os Secrets (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).");
      setLoading(false);
      return;
    }

    // Timeout to prevent infinite loading - reduced to 8s
    const timeout = setTimeout(() => {
      setLoading(prevLoading => {
        if (prevLoading) {
          console.warn("Supabase connection timeout reached.");
          return false;
        }
        return prevLoading;
      });
    }, 8000);

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(err => {
      clearTimeout(timeout);
      setEnvError(err.message);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <SupabaseContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {envError ? (
        <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-red-100 max-w-md">
            <h2 className="text-xl font-bold text-red-600 mb-4">Erro de Conexão</h2>
            <p className="text-slate-600 text-sm mb-6">{envError}</p>
            <div className="space-y-3">
              <button 
                onClick={() => window.location.reload()}
                className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                Tentar Novamente
              </button>
              <p className="text-[0.625rem] text-slate-400 uppercase font-black tracking-widest">
                Verifique os Secrets no painel de configurações
              </p>
            </div>
          </div>
        </div>
      ) : children}
    </SupabaseContext.Provider>
  );
};

'use client';

import React, { useState } from 'react';
import { useSupabase } from './SupabaseProvider';
import { supabase } from './supabase';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, ShieldAlert, Mail, Lock, UserPlus } from 'lucide-react';

export const SupabaseAuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading, profile } = useSupabase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  React.useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsUpdatingPassword(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) return;
    
    setAuthLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess("Senha atualizada com sucesso! Você já pode entrar.");
      setIsUpdatingPassword(false);
      setPassword('');
    } catch (err: any) {
      console.error("Update password error:", err);
      setError(err.message || "Erro ao atualizar senha.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setError(null);
      setSuccess(null);
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
        },
      });
      if (error) throw error;
    } catch (error: any) {
      console.error("Login failed (full object):", error);
      setError(error.message || "Falha ao entrar com Google.");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setAuthLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      setSuccess("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
    } catch (err: any) {
      console.error("Reset error:", err);
      setError(err.message || "Erro ao enviar e-mail de recuperação.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    
    setAuthLoading(true);
    setError(null);
    setSuccess(null);
    try {
      if (isRegistering) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Verifique seu e-mail para confirmar o cadastro.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error("Auth error (full object):", err);
      setError(err.message || "Ocorreu um erro na autenticação.");
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-blue-900 border-t-transparent rounded-full"
        />
        <div className="text-center space-y-2">
          <p className="text-xs font-bold text-blue-900/40 uppercase tracking-widest animate-pulse">
            Conectando ao Supabase...
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="text-[0.625rem] text-blue-900 font-black uppercase tracking-widest hover:underline"
          >
            Se demorar muito, clique aqui para recarregar
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          <div className="bg-blue-900 p-8 text-center text-white">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <ShieldAlert className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Livro Arquitetônico</h1>
            <p className="text-blue-100/80 text-sm mt-1">Gestão Inteligente (Supabase)</p>
          </div>

          <div className="p-8">
            {isUpdatingPassword ? (
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="text-center mb-6">
                  <h2 className="text-lg font-bold text-blue-900">Atualizar Senha</h2>
                  <p className="text-xs text-slate-500">Digite sua nova senha abaixo.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-[0.625rem] uppercase font-black text-slate-500 ml-1">Nova Senha</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-900/20 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <AnimatePresence>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-red-600 font-bold text-center"
                    >
                      {error}
                    </motion.p>
                  )}
                  {success && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-emerald-600 font-bold text-center"
                    >
                      {success}
                    </motion.p>
                  )}
                </AnimatePresence>
                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                >
                  {authLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      <Lock className="w-5 h-5" />
                      Atualizar Senha
                    </>
                  )}
                </button>
                <button 
                  type="button"
                  onClick={() => {
                    setIsUpdatingPassword(false);
                    setError(null);
                    setSuccess(null);
                    setPassword('');
                  }}
                  className="w-full text-center text-xs text-blue-900 font-bold hover:underline"
                >
                  Voltar para o Login
                </button>
              </form>
            ) : (
              <form onSubmit={isResettingPassword ? handleResetPassword : handleEmailAuth} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[0.625rem] uppercase font-black text-slate-500 ml-1">E-mail</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      required
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-900/20 outline-none transition-all"
                      placeholder="seu@email.com"
                    />
                  </div>
                </div>

                {!isResettingPassword && (
                  <div className="space-y-1">
                    <div className="flex justify-between items-center">
                      <label className="text-[0.625rem] uppercase font-black text-slate-500 ml-1">Senha</label>
                      <button 
                        type="button"
                        onClick={() => {
                          setIsResettingPassword(true);
                          setError(null);
                          setSuccess(null);
                        }}
                        className="text-[0.625rem] uppercase font-black text-blue-900 hover:underline"
                      >
                        Esqueceu a senha?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        required
                        type="password" 
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-900/20 outline-none transition-all"
                        placeholder="••••••••"
                      />
                    </div>
                  </div>
                )}

                <AnimatePresence>
                  {error && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-red-600 font-bold text-center"
                    >
                      {error}
                    </motion.p>
                  )}
                  {success && (
                    <motion.p 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="text-xs text-emerald-600 font-bold text-center"
                    >
                      {success}
                    </motion.p>
                  )}
                </AnimatePresence>

                <button
                  type="submit"
                  disabled={authLoading}
                  className="w-full py-4 bg-blue-900 text-white rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-blue-800 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
                >
                  {authLoading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <>
                      {isResettingPassword ? <Mail className="w-5 h-5" /> : isRegistering ? <UserPlus className="w-5 h-5" /> : <LogIn className="w-5 h-5" />}
                      {isResettingPassword ? 'Enviar E-mail de Recuperação' : isRegistering ? 'Criar Conta' : 'Entrar'}
                    </>
                  )}
                </button>

                {isResettingPassword && (
                  <button 
                    type="button"
                    onClick={() => {
                      setIsResettingPassword(false);
                      setError(null);
                      setSuccess(null);
                    }}
                    className="w-full text-center text-xs text-blue-900 font-bold hover:underline"
                  >
                    Voltar para o Login
                  </button>
                )}
              </form>
            )}

            <div className="relative my-8">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[0.625rem] uppercase font-black text-slate-400"><span className="bg-white px-4">Ou continue com</span></div>
            </div>

            <button
              onClick={handleGoogleLogin}
              className="w-full py-3 border border-slate-200 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-all"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              Google
            </button>

            <p className="mt-8 text-center text-xs text-slate-500">
              {isRegistering ? 'Já tem uma conta?' : 'Não tem uma conta?'}
              <button 
                onClick={() => setIsRegistering(!isRegistering)}
                className="ml-1 text-blue-900 font-bold hover:underline"
              >
                {isRegistering ? 'Faça login' : 'Cadastre-se'}
              </button>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  const isCorretor = profile?.role === 'corretor' || profile?.role === 'admin';

  if (!isCorretor) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <ShieldAlert className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-blue-900 mb-2">Acesso Restrito</h1>
          <p className="text-slate-500 text-sm leading-relaxed">Sua conta ainda não possui permissões de corretor no Supabase.</p>
          <button 
            onClick={() => supabase.auth.signOut()}
            className="mt-8 text-blue-900 font-bold text-sm hover:underline"
          >
            Sair e entrar com outra conta
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

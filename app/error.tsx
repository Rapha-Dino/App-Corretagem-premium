'use client';

import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Ops! Algo deu errado</h2>
        <p className="text-slate-500 mb-6 text-sm">
          {error.message || "Ocorreu um erro inesperado no aplicativo."}
        </p>
        <button
          onClick={() => reset()}
          className="w-full py-3 bg-blue-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800 transition-all"
        >
          <RefreshCcw className="w-4 h-4" />
          Tentar Novamente
        </button>
      </div>
    </div>
  );
}

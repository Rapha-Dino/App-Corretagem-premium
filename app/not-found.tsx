'use client';

import React from 'react';
import Link from 'next/link';
import { Search, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-2xl p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <Search className="w-8 h-8 text-blue-900" />
        </div>
        <h2 className="text-2xl font-bold text-blue-900 mb-2">Página não encontrada</h2>
        <p className="text-slate-500 mb-8 text-sm">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link
          href="/"
          className="w-full py-3 bg-blue-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-800 transition-all"
        >
          <Home className="w-4 h-4" />
          Voltar ao Início
        </Link>
      </div>
    </div>
  );
}

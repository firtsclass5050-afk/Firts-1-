import React, { useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Clock } from 'lucide-react';
import { motion } from 'motion/react';
import { MOTIVATIONAL_QUOTES } from '../constants';

export const Lobby = () => {
  const { logout, profile } = useAuth();
  
  const quote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[randomIndex];
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-bordeaux-dark to-orange-primary p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md p-8 rounded-[2.5rem] shadow-2xl text-center border border-white/20">
        <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6 backdrop-blur-sm">
          <Clock className="w-10 h-10 text-white animate-pulse" />
        </div>
        <h2 className="text-3xl font-bold text-white mb-4 tracking-tight">Acceso Pendiente</h2>
        <p className="text-white/80 mb-6 leading-relaxed font-bold">
          Hola <span className="font-bold text-white">{profile?.displayName}</span>, tu cuenta está siendo revisada por la dirección. 
          Te notificaremos una vez que tu rol sea asignado.
        </p>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mb-8 p-6 bg-black/10 rounded-2xl border border-white/5"
        >
          <p className="text-sm italic text-white/90">"{quote.text}"</p>
        </motion.div>

        <button 
          onClick={logout}
          className="w-full bg-white text-stone-900 py-4 rounded-2xl font-bold hover:bg-stone-100 transition-all shadow-lg"
        >
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
};

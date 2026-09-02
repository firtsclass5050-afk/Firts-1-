import React, { useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { LOGO_URL, MOTIVATIONAL_QUOTES } from '../constants';
import { motion } from 'motion/react';

export const Login = () => {
  const { login } = useAuth();
  
  const quote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[randomIndex];
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-bordeaux-dark to-orange-primary p-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-md rounded-3xl shadow-2xl overflow-hidden border border-white/20">
        <div className="p-8 text-center text-white">
          <motion.div 
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="w-48 h-48 md:w-64 md:h-64 mx-auto mb-6 flex items-center justify-center bg-white/20 rounded-full p-4 backdrop-blur-sm"
          >
            <img src={LOGO_URL} alt="First Classe Logo" className="w-full h-full object-contain drop-shadow-2xl" />
          </motion.div>
          
          <h1 className="text-4xl font-black mb-2 tracking-tight">First Classe</h1>
          <p className="text-white/70 font-bold mb-8">English Institute Platform</p>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
            className="mb-8 p-6 bg-black/20 rounded-2xl border border-white/10"
          >
            <p className="text-lg italic font-serif leading-relaxed text-white">
              "{quote.text}"
            </p>
            <p className="mt-2 text-sm font-bold text-white/60">— {quote.author}</p>
          </motion.div>

          <button 
            onClick={login}
            className="w-full flex items-center justify-center gap-3 bg-white text-stone-900 py-4 rounded-2xl font-bold hover:bg-stone-100 transition-all shadow-xl hover:scale-[1.02] active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-6 h-6" />
            Continuar con Google
          </button>
          
          <p className="mt-8 text-center text-xs text-white/40 font-bold uppercase tracking-widest">
            Acceso exclusivo para personal autorizado
          </p>
        </div>
      </div>
    </div>
  );
};

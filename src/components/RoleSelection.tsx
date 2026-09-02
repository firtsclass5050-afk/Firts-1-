import React, { useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { ShieldCheck, UserCheck, GraduationCap, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { LOGO_URL, MOTIVATIONAL_QUOTES } from '../constants';

export const RoleSelection = () => {
  const { setViewMode } = useAuth();

  const quote = useMemo(() => {
    const randomIndex = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
    return MOTIVATIONAL_QUOTES[randomIndex];
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-bordeaux-dark to-orange-primary flex items-center justify-center p-4">
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-8 bg-white/10 backdrop-blur-md p-10 rounded-[3rem] border border-white/20 shadow-2xl">
        <div className="md:col-span-2 text-center mb-4">
          <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="w-32 h-32 mx-auto mb-6 bg-white/20 rounded-full p-4 backdrop-blur-sm shadow-xl"
          >
            <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
          </motion.div>
          <h1 className="text-4xl font-black text-white tracking-tight">Panel Master</h1>
          <p className="text-white/70 mt-2 font-bold">Selecciona el panel que deseas gestionar hoy.</p>
        </div>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="md:col-span-2 mb-4 p-6 bg-black/20 rounded-2xl border border-white/10 text-center"
        >
          <p className="text-lg italic font-serif leading-relaxed text-white">
            "{quote.text}"
          </p>
          <p className="mt-2 text-xs font-bold text-white/50 uppercase tracking-widest">— {quote.author}</p>
        </motion.div>

        {[
          { mode: 'admin', title: 'Panel de Dirección', icon: ShieldCheck, color: 'bg-bordeaux', desc: 'Gestiona la administración global del instituto.' },
          { mode: 'teacher', title: 'Panel de Profesor', icon: UserCheck, color: 'bg-orange-primary', desc: 'Gestiona tus clases, listas y calificaciones.' }
        ].map((item) => (
          <motion.button
            key={item.mode}
            whileHover={{ y: -10 }}
            onClick={() => setViewMode(item.mode as any)}
            className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-stone-200 text-left group transition-all hover:shadow-2xl hover:border-black"
          >
            <div className={`w-16 h-16 ${item.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg shadow-black/5`}>
              <item.icon className="w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-stone-900 mb-3">{item.title}</h3>
            <p className="text-stone-500 text-sm leading-relaxed mb-6">{item.desc}</p>
            <div className="flex items-center gap-2 text-stone-900 font-bold text-sm tracking-widest uppercase">
              <span>Ingresar</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

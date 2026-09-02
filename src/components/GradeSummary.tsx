import React from 'react';
import { Grade } from '../types';
import { Award, TrendingUp, Medal } from 'lucide-react';
import { cn } from '../utils/cn';

export const GradeSummary = ({ grades }: { grades: Grade[] }) => {
  if (!grades || grades.length === 0) return null;

  const getFinalGrade = (grade: Grade) => {
    return Number(grade.quiz || 0) + 
           Number(grade.participation || 0) + 
           Number(grade.workbooks || 0) + 
           Number(grade.oralExam || 0) + 
           Number(grade.writtenExam || 0);
  };

  const latestGrade = grades[0];
  const total = getFinalGrade(latestGrade);
  const isPassed = total >= 70;

  return (
    <div className="bg-white p-6 rounded-3xl border border-stone-100 shadow-sm flex items-center justify-between group hover:border-orange-primary/30 transition-all">
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:rotate-6",
          isPassed ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
        )}>
          {isPassed ? <Medal className="w-6 h-6" /> : <Award className="w-6 h-6" />}
        </div>
        <div>
          <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none mb-1">Última Calificación</p>
          <div className="flex items-center gap-2">
             <span className="text-xl font-black text-stone-900">{total}</span>
             <span className={cn(
               "text-[9px] font-black px-2 py-0.5 rounded-full",
               isPassed ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
             )}>
               {isPassed ? 'APROBADO' : 'REPROBADO'}
             </span>
          </div>
        </div>
      </div>
      <div className="text-right">
        <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest leading-none mb-1">Tu Promedio</p>
        <p className="text-xl font-black text-emerald-600">
           {(grades.reduce((acc, g) => acc + getFinalGrade(g), 0) / grades.length).toFixed(1)}
        </p>
      </div>
    </div>
  );
};

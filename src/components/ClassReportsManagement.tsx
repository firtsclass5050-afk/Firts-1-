import React, { useState, useEffect } from 'react';
import { Search, Calendar, User as UserIcon, FileDown, BookOpen, Clock, CheckCircle, X, ArrowRight, Mail, Phone, Award, Users, ChevronDown, ChevronUp, Printer } from 'lucide-react';
import { collection, onSnapshot, query, where, orderBy, doc, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../AuthContext';
import { ClassReport, UserProfile, TeacherReplacement, Course, TeacherReportsProps } from '../types';
import { cn } from '../utils/cn';
import { handleFirestoreError, OperationType } from '../firebase';
import { motion, AnimatePresence } from 'motion/react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { LOGO_URL } from '../constants';

const downloadSingleClassReportPDF = async (report: ClassReport) => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const loadLogo = (): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          try {
            resolve(canvas.toDataURL('image/png'));
            return;
          } catch (e) {
            console.log('Canvas toDataURL failed:', e);
          }
        }
        resolve(null);
      };
      img.onerror = () => resolve(null);
      img.src = LOGO_URL;
    });
  };

  const logoBase64 = await loadLogo();

  // Double border frame
  doc.setDrawColor(28, 25, 23);
  doc.setLineWidth(0.8);
  doc.rect(8, 8, 194, 281);
  doc.setLineWidth(0.2);
  doc.rect(9.5, 9.5, 191, 278);

  // Logo & Header
  if (logoBase64) {
    doc.addImage(logoBase64, 'PNG', 15, 12, 24, 24);
  }
  
  doc.setTextColor(28, 25, 23);
  doc.setFont('times', 'bolditalic');
  doc.setFontSize(22);
  const titleText = report.type === 'weekday' ? 'WEEKDAY CLASS REPORT' : report.type === 'saturday' ? 'SATURDAY CLASS REPORT' : 'CLASS PROGRESS REPORT';
  doc.text(titleText, 45, 22);
  
  doc.setDrawColor(115, 12, 32);
  doc.setLineWidth(1.5);
  doc.line(45, 24, 195, 24);

  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Academic Activities & Content Tracking Log', 45, 29);

  // Metadata divider
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.3);
  doc.line(15, 34, 195, 34);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(28, 25, 23);
  doc.setFontSize(8.5);

  const metaData = [
    { label: 'FACILITATOR', val: report.teacherName, x: 15, y: 40 },
    { label: 'LEVEL', val: report.level || 'Starter', x: 80, y: 40 },
    { label: 'SCHEDULE', val: report.schedule, x: 130, y: 40 },
    { label: 'START DATE', val: report.startDate, x: 15, y: 46 },
    { label: 'END DATE', val: report.endDate, x: 80, y: 46 },
    { label: 'MONTH', val: report.month ? report.month.toUpperCase() : 'N/A', x: 130, y: 46 },
  ];

  metaData.forEach(item => {
    doc.setFont('helvetica', 'bold');
    doc.text(`${item.label}:`, item.x, item.y);
    doc.setFont('helvetica', 'normal');
    const offset = doc.getTextWidth(`${item.label}:`) + 2;
    doc.text(item.val || 'N/A', item.x + offset, item.y);
  });

  // Type checkboxes
  doc.setFont('helvetica', 'bold');
  doc.text('REGULAR:', 15, 52);
  doc.rect(38, 49, 4, 4);
  if (report.isRegular) doc.text('X', 39, 52.2);

  doc.text('ACELERADO:', 50, 52);
  doc.rect(75, 49, 4, 4);
  if (report.isAccelerated) doc.text('X', 76, 52.2);

  doc.line(15, 56, 195, 56);

  // Filters empty cells from the PDF to make it elegant and save space
  const activeGridItems = report.grid?.filter(item => item.content?.trim() || item.date?.trim() || item.page?.trim()) || [];
  
  const headers = [['Nº', 'FECHA', 'ACCION / CONTENIDO', 'PAG.']];
  const tableRows = activeGridItems.map((item, idx) => [
    idx + 1,
    item.date || '',
    item.content || '',
    item.page || ''
  ]);

  if (tableRows.length === 0) {
    tableRows.push(['1', '-', 'No se han registrado clases en este periodo.', '-']);
  }

  autoTable(doc, {
    startY: 60,
    head: headers,
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [115, 12, 32],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      halign: 'center'
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 25, halign: 'center' },
      2: { fontStyle: 'normal', fontSize: 8 },
      3: { cellWidth: 20, halign: 'center' }
    },
    styles: {
      cellPadding: 2,
      fontSize: 8,
      overflow: 'linebreak'
    },
    margin: { left: 15, right: 15 }
  });

  const finalY = (doc as any).lastAutoTable.finalY || 120;

  // Counters
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`TOTAL CLASES IMPARTIDAS: ${activeGridItems.length}`, 15, finalY + 10);

  // Signature Block
  const sigY = Math.min(finalY + 30, 260);
  doc.setDrawColor(150, 150, 150);
  doc.line(25, sigY, 90, sigY);
  doc.line(120, sigY, 185, sigY);

  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('FIRMA DEL DOCENTE', 57.5, sigY + 5, { align: 'center' });
  doc.text('FIRMA DIRECCIÓN ACADÉMICA', 152.5, sigY + 5, { align: 'center' });

  // Download PDF
  const safeCourseName = (report.courseName || 'class_report').replace(/\s+/g, '_');
  const monthName = (report.month || 'month').replace(/\s+/g, '_');
  doc.save(`Class_Report_${safeCourseName}_${monthName}.pdf`);
};

const ReportDetailView = ({ report, onClose }: { report: ClassReport, onClose: () => void }) => {
  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];
  
  return (
    <div className="flex flex-col h-full bg-white font-sans text-stone-900">
       {/* Screen view */}
       <div className="flex-1 flex flex-col overflow-y-auto no-scrollbar p-8 print:hidden">
          <div className="relative mb-6">
             <div className="absolute top-0 right-0">
                <img src={LOGO_URL} alt="Logo" className="h-20" />
             </div>
             <h2 className="text-3xl font-bold text-center uppercase tracking-normal mb-8 pt-4">
                {report.type === 'weekday' ? 'WEEKDAY CLASS REPORT' : report.type === 'saturday' ? 'SATURDAY CLASS REPORT' : report.type === 'custom' ? 'CUSTOM CLASS REPORT' : 'CLASS PROGRESS REPORT'}
             </h2>

             <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1.2fr_0.8fr] gap-x-12 gap-y-3 text-[13px]">
                <div className="flex items-center gap-2">
                   <span className="font-bold whitespace-nowrap min-w-[80px] md:min-w-0">Facilitator:</span>
                   <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold">{report.teacherName}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="font-bold whitespace-nowrap min-w-[80px] md:min-w-0">Level:</span>
                   <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold">{report.level}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="font-bold whitespace-nowrap min-w-[80px] md:min-w-0">Start Date:</span>
                   <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold">{report.startDate}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                   <span className="font-bold whitespace-nowrap">Regular:</span>
                   <div className="w-5 h-5 border-2 border-stone-900 flex items-center justify-center">
                      {report.isRegular && <div className="w-3 h-3 bg-stone-700" />}
                   </div>
                </div>
    
                <div className="flex items-center gap-2">
                   <span className="font-bold whitespace-nowrap min-w-[80px] md:min-w-0">Schedule:</span>
                   <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold">{report.schedule}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="font-bold whitespace-nowrap min-w-[80px] md:min-w-0">Month:</span>
                   <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold capitalize">{report.month}</span>
                </div>
                <div className="flex items-center gap-2">
                   <span className="font-bold whitespace-nowrap min-w-[80px] md:min-w-0">End Date:</span>
                   <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold">{report.endDate}</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                   <span className="font-bold whitespace-nowrap">Accelerated:</span>
                   <div className="w-5 h-5 border-2 border-stone-900 flex items-center justify-center">
                      {report.isAccelerated && <div className="w-3 h-3 bg-stone-700" />}
                   </div>
                </div>
             </div>
          </div>

          {report.type === 'weekday' || report.type === 'custom' ? (
             <div className="border-[1.5px] border-stone-900 overflow-x-auto flex-1 flex flex-col mb-4 no-scrollbar">
                <div className="min-w-[800px] flex flex-col flex-1">
                   <div className="grid grid-cols-5 border-b-[1.5px] border-stone-900 bg-white">
                      {weekdays.map(day => (
                         <div key={day} className="py-1 text-center text-[12px] font-bold border-r-[1.5px] last:border-0 border-stone-900 uppercase">{day}</div>
                      ))}
                   </div>
                   <div className="grid grid-cols-5 flex-1 divide-x-[1.5px] divide-stone-900 border-b-[1.5px] border-stone-900 last:border-b-0 bg-white">
                      {weekdays.map((_, dayIdx) => (
                         <div key={dayIdx} className="flex flex-col divide-y-[1.5px] divide-stone-900">
                            {Array(5).fill(0).map((__, weekIdx) => {
                               const itemIdx = weekIdx * 5 + dayIdx;
                               const item = report.grid?.[itemIdx] || { date: '', page: '', content: '' };
                               return (
                                  <div key={itemIdx} className="flex flex-col min-h-[140px]">
                                     <div className="flex-1 p-2 text-[11px] font-bold leading-tight whitespace-pre-wrap">
                                        {item.content}
                                      </div>
                                      <div className="border-t-[1.5px] border-stone-900 grid grid-cols-[auto_1fr_auto_1fr] text-[10px] items-center">
                                         <span className="px-1.5 border-r-[1.5px] border-stone-900 font-bold py-1 bg-stone-50/30">Date:</span>
                                         <span className="px-1.5 border-r-[1.5px] border-stone-900 py-1 min-h-[20px]">{item.date}</span>
                                         <span className="px-1.5 border-r-[1.5px] border-stone-900 font-bold py-1 bg-stone-50/30">Page:</span>
                                         <span className="px-1.5 py-1 min-h-[20px]">{item.page}</span>
                                      </div>
                                  </div>
                               );
                            })}
                         </div>
                      ))}
                   </div>
                </div>
                <div className="flex justify-end bg-white border-t-[1.5px] border-stone-900">
                   <div className="flex items-center border-l-[1.5px] border-stone-900">
                      <div className="px-6 py-2 bg-white border-r-[1.5px] border-stone-900">
                         <span className="text-[12px] font-bold uppercase tracking-widest">TOTAL CLASES:</span>
                      </div>
                      <div className="w-20 py-2 flex items-center justify-center font-bold text-lg">
                         {report.grid?.filter(i => i.content?.trim() !== '').length || 0}
                      </div>
                   </div>
                </div>
             </div>
          ) : (
             <div className="border-[1.5px] border-stone-900 overflow-x-auto flex-1 mb-4 flex flex-col no-scrollbar">
                <div className="min-w-[800px] flex flex-col flex-1">
                   <div className="grid grid-cols-4 border-b-[1.5px] border-stone-900 bg-white">
                      {Array(4).fill(0).map((_, idx) => (
                         <div key={idx} className="py-2 text-center text-[12px] font-bold border-r-[1.5px] last:border-0 border-stone-900 uppercase">SATURDAY</div>
                      ))}
                   </div>
                   <div className="grid grid-cols-4 flex-1 divide-x-[1.5px] divide-stone-900 border-b-[1.5px] border-stone-900 last:border-b-0 bg-white">
                      {Array(4).fill(0).map((_, idx) => {
                         const item = report.grid?.[idx] || { date: '', page: '', content: '' };
                         return (
                            <div key={idx} className="flex flex-col min-h-[300px]">
                               <div className="flex-1 p-4 text-xs font-bold leading-relaxed italic whitespace-pre-wrap">{item.content}</div>
                               <div className="border-t-[1.5px] border-stone-900 grid grid-cols-[auto_1fr_auto_1fr] text-[10px] items-center">
                                  <span className="px-2 border-r-[1.5px] border-stone-900 font-bold py-2 bg-stone-50/30">Date:</span>
                                  <span className="px-2 border-r-[1.5px] border-stone-900 py-2 min-h-[24px] uppercase">{item.date}</span>
                                  <span className="px-2 border-r-[1.5px] border-stone-900 font-bold py-2 bg-stone-50/30">Page:</span>
                                  <span className="px-2 py-2 min-h-[24px]">{item.page}</span>
                               </div>
                            </div>
                         );
                      })}
                   </div>
                </div>
                <div className="flex justify-end bg-white">
                   <div className="flex items-center border-l-[1.5px] border-stone-900">
                      <div className="px-6 py-3 bg-white border-r-[1.5px] border-stone-900">
                         <span className="text-[12px] font-bold uppercase tracking-widest">TOTAL CLASES:</span>
                      </div>
                      <div className="w-24 py-3 flex items-center justify-center font-bold text-xl font-serif italic">
                         {report.grid?.filter(i => i.content?.trim() !== '').length || 0}
                      </div>
                   </div>
                </div>
             </div>
          )}
       </div>

       {/* Print-only layout styled precisely to match the screen grid exactly */}
       <div className="hidden print:block fixed inset-0 bg-white z-[100] p-12 m-0 overflow-y-auto text-stone-900 font-sans">
         <div className="max-w-[800px] mx-auto border-4 border-stone-900 p-8 relative min-h-[1050px] flex flex-col justify-between">
           <div>
             <div className="relative mb-6">
               <div className="absolute top-0 right-0">
                 <img src={LOGO_URL} alt="Logo" className="h-16" />
               </div>
               <h2 className="text-2xl font-black text-center uppercase tracking-normal mb-6 pt-4 border-b-2 border-stone-950 pb-2">
                 {report.type === 'weekday' ? 'WEEKDAY CLASS REPORT' : report.type === 'saturday' ? 'SATURDAY CLASS REPORT' : 'CLASS PROGRESS REPORT'}
               </h2>
               <p className="text-[9px] text-center text-stone-400 font-bold uppercase tracking-widest -mt-4 mb-6">Academic Activities & Content Tracking Log</p>
             </div>

             <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-[11px] border-b border-stone-900 pb-4 mb-6">
               <div><strong>FACILITATOR:</strong> {report.teacherName}</div>
               <div><strong>LEVEL:</strong> {report.level}</div>
               <div><strong>START DATE:</strong> {report.startDate}</div>
               <div><strong>REGULAR:</strong> {report.isRegular ? 'SÍ' : 'NO'}</div>
               <div><strong>SCHEDULE:</strong> {report.schedule}</div>
               <div><strong>MONTH:</strong> {report.month?.toUpperCase()}</div>
               <div><strong>END DATE:</strong> {report.endDate}</div>
               <div><strong>ACELERADO:</strong> {report.isAccelerated ? 'SÍ' : 'NO'}</div>
             </div>

             {report.type === 'weekday' || report.type === 'custom' ? (
                <div className="border-[1.5px] border-stone-900 flex flex-col mb-4 bg-white text-stone-950 text-[10px]">
                   <div className="grid grid-cols-5 border-b-[1.5px] border-stone-900 bg-stone-50">
                      {weekdays.map(day => (
                         <div key={day} className="py-1 text-center font-bold border-r-[1.5px] last:border-0 border-stone-900 uppercase">{day}</div>
                      ))}
                   </div>
                   <div className="grid grid-cols-5 divide-x-[1.5px] divide-stone-900 border-b-[1.5px] border-stone-900 last:border-b-0">
                      {weekdays.map((_, dayIdx) => (
                         <div key={dayIdx} className="flex flex-col divide-y-[1.5px] divide-stone-900">
                            {Array(5).fill(0).map((__, weekIdx) => {
                               const itemIdx = weekIdx * 5 + dayIdx;
                               const item = report.grid?.[itemIdx] || { date: '', page: '', content: '' };
                               return (
                                  <div key={itemIdx} className="flex flex-col min-h-[120px] justify-between bg-white">
                                     <div className="p-1 font-semibold leading-tight whitespace-pre-wrap text-[9px] break-words">
                                        {item.content || <span className="text-stone-300 italic">...</span>}
                                     </div>
                                     <div className="border-t-[1.5px] border-stone-900 grid grid-cols-[auto_1fr_auto_1fr] text-[8px] items-center bg-stone-50/50">
                                        <span className="px-1 border-r-[1.5px] border-stone-900 font-bold py-0.5">D:</span>
                                        <span className="px-1 border-r-[1.5px] border-stone-900 py-0.5 truncate max-w-[30px]">{item.date}</span>
                                        <span className="px-1 border-r-[1.5px] border-stone-900 font-bold py-0.5">P:</span>
                                        <span className="px-1 py-0.5 truncate max-w-[20px]">{item.page}</span>
                                     </div>
                                  </div>
                               );
                            })}
                         </div>
                      ))}
                   </div>
                   <div className="flex justify-end bg-white border-t-[1.5px] border-stone-900">
                      <div className="flex items-center border-l-[1.5px] border-stone-900">
                         <div className="px-4 py-1.5 bg-stone-50 border-r-[1.5px] border-stone-900">
                            <span className="font-bold uppercase tracking-wider text-[9px]">TOTAL CLASES:</span>
                         </div>
                         <div className="w-16 py-1.5 flex items-center justify-center font-bold text-xs">
                            {report.grid?.filter(i => i.content?.trim() !== '').length || 0}
                         </div>
                      </div>
                   </div>
                </div>
             ) : (
                <div className="border-[1.5px] border-stone-900 flex flex-col mb-4 bg-white text-stone-950 text-[10px]">
                   <div className="grid grid-cols-4 border-b-[1.5px] border-stone-900 bg-stone-50">
                      {Array(4).fill(0).map((_, idx) => (
                         <div key={idx} className="py-1.5 text-center font-bold border-r-[1.5px] last:border-0 border-stone-900 uppercase">SATURDAY</div>
                      ))}
                   </div>
                   <div className="grid grid-cols-4 divide-x-[1.5px] divide-stone-900 border-b-[1.5px] border-stone-900 last:border-b-0">
                      {Array(4).fill(0).map((_, idx) => {
                         const item = report.grid?.[idx] || { date: '', page: '', content: '' };
                         return (
                            <div key={idx} className="flex flex-col min-h-[250px] justify-between bg-white">
                               <div className="p-2 font-semibold leading-relaxed italic whitespace-pre-wrap text-[10px] break-words">
                                  {item.content || <span className="text-stone-300">...</span>}
                               </div>
                               <div className="border-t-[1.5px] border-stone-900 grid grid-cols-[auto_1fr_auto_1fr] text-[8px] items-center bg-stone-50/50">
                                  <span className="px-1 border-r-[1.5px] border-stone-900 font-bold py-1">Date:</span>
                                  <span className="px-1 border-r-[1.5px] border-stone-900 py-1 uppercase truncate">{item.date}</span>
                                  <span className="px-1 border-r-[1.5px] border-stone-900 font-bold py-1">Page:</span>
                                  <span className="px-1 py-1 truncate">{item.page}</span>
                                </div>
                             </div>
                          );
                       })}
                    </div>
                    <div className="flex justify-end bg-white border-t-[1.5px] border-stone-900">
                       <div className="flex items-center border-l-[1.5px] border-stone-900">
                          <div className="px-4 py-2 bg-stone-50 border-r-[1.5px] border-stone-900">
                             <span className="font-bold uppercase tracking-wider text-[9px]">TOTAL CLASES:</span>
                          </div>
                          <div className="w-20 py-2 flex items-center justify-center font-bold text-xs">
                             {report.grid?.filter(i => i.content?.trim() !== '').length || 0}
                          </div>
                       </div>
                    </div>
                 </div>
              )}
            </div>

            <div className="mt-12 grid grid-cols-2 gap-16 text-center text-[10px] font-sans text-stone-500">
              <div className="border-t border-stone-900 pt-3">
                <p className="font-extrabold text-stone-800 uppercase tracking-widest text-[9px]">FIRMA DEL DOCENTE</p>
              </div>
              <div className="border-t border-stone-900 pt-3">
                <p className="font-extrabold text-stone-800 uppercase tracking-widest text-[9px]">FIRMA DIRECCIÓN ACADÉMICA</p>
              </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export const ClassReportsManagement = () => {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<ClassReport[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'weekday' | 'saturday' | 'custom' | 'replacements'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedReport, setSelectedReport] = useState<ClassReport | null>(null);
  const [teacherReplacements, setTeacherReplacements] = useState<TeacherReplacement[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'classReports'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassReport)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classReports'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'teacherReplacements'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeacherReplacements(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TeacherReplacement)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'teacherReplacements'));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', 'in', ['teacher', 'master']));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'users'));
    return () => unsubscribe();
  }, []);

  const handleStatusUpdate = async (reportId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const reportRef = doc(db, 'classReports', reportId);
      await updateDoc(reportRef, { status: newStatus });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'classReports');
    }
  };

  const filteredReports = reports.filter(report => {
    const matchesTeacher = selectedTeacher 
      ? (report.teacherId === selectedTeacher.uid || report.teacherName === selectedTeacher.displayName)
      : report.teacherName?.toLowerCase().includes(teacherSearch.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || 
                        (statusFilter === 'pending' && (report.status === 'pending' || report.status === 'submitted')) ||
                        report.status === statusFilter;
    const matchesType = activeTab === 'all' || 
                       (activeTab === 'weekday' && report.type === 'weekday') ||
                       (activeTab === 'saturday' && report.type === 'saturday') ||
                       (activeTab === 'custom' && (report.type === 'custom' || !report.type));

    const reportDate = report.date?.toDate?.();
    const matchesDate = (!startDate || (reportDate && reportDate >= new Date(startDate))) &&
                        (!endDate || (reportDate && reportDate <= new Date(endDate + 'T23:59:59')));
    
    return matchesTeacher && matchesStatus && matchesType && matchesDate;
  });

  const filteredReplacements = teacherReplacements.filter(replacement => {
    const matchesTeacher = selectedTeacher 
      ? (replacement.replacingTeacherId === selectedTeacher.uid || replacement.replacingTeacherName === selectedTeacher.displayName)
      : replacement.replacingTeacherName?.toLowerCase().includes(teacherSearch.toLowerCase());
    
    const reportDate = replacement.date?.toDate?.();
    const matchesDate = (!startDate || (reportDate && reportDate >= new Date(startDate))) &&
                        (!endDate || (reportDate && reportDate <= new Date(endDate + 'T23:59:59')));
    
    return matchesTeacher && matchesDate;
  });

  const replacementStats = filteredReplacements.reduce((acc, replacement) => {
    const teacherName = replacement.replacingTeacherName;
    if (!acc[teacherName]) {
      acc[teacherName] = { teacherName, regular: 0, accelerated: 0, saturday: 0, personalized: 0, total: 0 };
    }
    
    const type = replacement.classType;
    if (type === 'Regular') acc[teacherName].regular++;
    else if (type === 'Acelerado') acc[teacherName].accelerated++;
    else if (type === 'Sábados') acc[teacherName].saturday++;
    else acc[teacherName].personalized++;
    
    acc[teacherName].total++;
    return acc;
  }, {} as Record<string, { teacherName: string, regular: number, accelerated: number, saturday: number, personalized: number, total: number }>);

   const stats = filteredReports.reduce((acc, report) => {
    if (report.isReplacement) {
      acc.replacement++;
    } else {
      const type = report.type || 'custom';
      if (type === 'weekday') {
        if (report.isAccelerated) acc.accelerated++;
        else acc.regular++;
      } else if (type === 'saturday') {
        acc.saturday++;
      } else {
        acc.custom++;
      }
    }
    acc.total++;
    return acc;
  }, { regular: 0, accelerated: 0, saturday: 0, custom: 0, total: 0, replacement: 0 });

  if (selectedReport) {
    return (
      <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <button 
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-stone-400 hover:text-stone-900 font-black uppercase tracking-widest text-[10px] transition-colors no-print"
        >
          <X className="w-4 h-4" />
          Volver al listado
        </button>
        
        <div className="bg-white rounded-[2rem] border-2 border-stone-900 shadow-2xl p-8 border-b-8 border-b-black">
          <div className="mb-6 flex justify-end gap-3 no-print">
            <button
              onClick={() => window.print()}
              className="px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-md"
            >
              <Printer className="w-4 h-4" />
              Imprimir Reporte
            </button>
            <button
              onClick={() => downloadSingleClassReportPDF(selectedReport)}
              className="px-5 py-2.5 bg-red-900 hover:bg-red-950 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-md"
            >
              <FileDown className="w-4 h-4" />
              Descargar PDF
            </button>
          </div>

          <ReportDetailView report={selectedReport} onClose={() => setSelectedReport(null)} />
          
          <div className="mt-8 flex justify-end gap-4 border-t border-stone-100 pt-8 no-print">
            {selectedReport.status !== 'approved' && (
              <button 
                onClick={() => {
                  handleStatusUpdate(selectedReport.id!, 'approved');
                  setSelectedReport(null);
                }}
                className="px-8 py-3 bg-emerald-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-emerald-700 transition-all flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                Aprobar Reporte
              </button>
            )}
            {selectedReport.status !== 'rejected' && (
              <button 
                onClick={() => {
                  handleStatusUpdate(selectedReport.id!, 'rejected');
                  setSelectedReport(null);
                }}
                className="px-8 py-3 bg-red-600 text-white rounded-xl font-black uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all flex items-center gap-2"
              >
                <X className="w-4 h-4" />
                Rechazar
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const downloadTeacherReportsPDF = () => {
    const doc = new jsPDF();
    const teacherName = selectedTeacher?.displayName || teacherSearch || "General";
    
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 32);
    doc.text('Auditoría de Reportes - Dirección', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(`Profesor: ${teacherName}`, 20, 35);
    doc.text(`Fecha: ${new Date().toLocaleDateString()}`, 20, 42);

    if (startDate || endDate) {
      const startStr = startDate ? startDate.split('-').reverse().join('/') : 'Inicio';
      const endStr = endDate ? endDate.split('-').reverse().join('/') : 'Fin';
      const rangeText = `Periodo: ${startStr} - ${endStr}`;
      doc.setFontSize(10);
      doc.text(rangeText, 20, 49);
    }

    autoTable(doc, {
      startY: startDate || endDate ? 55 : 50,
      head: [['Categoría', 'Cantidad']],
      body: [
        ['Regular (L-V)', stats.regular],
        ['Acelerada (L-V)', stats.accelerated],
        ['Sábados', stats.saturday],
        ['Personalizadas', stats.custom],
        ['Remplazos', stats.replacement],
        ['TOTAL ACUMULADO', stats.total],
      ],
      theme: 'grid',
      headStyles: { fillColor: [20, 20, 20] }
    });

    const tableData = filteredReports.map(r => [
      r.date?.toDate?.()?.toLocaleDateString() || 'N/A',
      r.teacherName || 'N/A',
      r.courseName + (r.isReplacement ? ' (REMPLAZO)' : '') || 'N/A',
      r.type === 'weekday' ? (r.isAccelerated ? 'Acelerado' : 'Regular') : (r.type === 'saturday' ? 'Sábado' : 'Personalizado'),
      r.status
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Fecha', 'Profesor', 'Curso', 'Tipo', 'Estado']],
      body: tableData,
      headStyles: { fillColor: [128, 0, 32] },
      styles: { fontSize: 8 }
    });

    doc.save(`Informe_Reportes_${teacherName.replace(/\s+/g, '_')}.pdf`);
  };

  const downloadReplacementsPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.setTextColor(128, 0, 32);
    doc.text('Auditoría de Reemplazos', 105, 20, { align: 'center' });
    
    doc.setFontSize(12);
    doc.setTextColor(60, 60, 60);
    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 20, 35);

    if (startDate || endDate) {
      const startStr = startDate ? startDate.split('-').reverse().join('/') : 'Inicio';
      const endStr = endDate ? endDate.split('-').reverse().join('/') : 'Fin';
      doc.text(`Periodo: ${startStr} - ${endStr}`, 20, 42);
    }

    const tableData = filteredReplacements.map(r => [
      r.replacingTeacherName,
      r.replacedTeacherName,
      r.classLevel,
      r.classType,
      r.schedule,
      r.date?.toDate?.()?.toLocaleDateString() || 'N/A',
      r.progressReport || 'N/A'
    ]);

    autoTable(doc, {
      startY: 50,
      head: [['Reemplaza', 'Reemplazado', 'Nivel', 'Tipo', 'Horario', 'Fecha', 'Avance']],
      body: tableData,
      headStyles: { fillColor: [128, 0, 32] },
      styles: { fontSize: 7 }
    });

    const statsData = Object.values(replacementStats).map(s => [
      s.teacherName,
      s.regular,
      s.accelerated,
      s.saturday,
      s.personalized,
      s.total
    ]);

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 15,
      head: [['Docente', 'Reg', 'Ace', 'Sab', 'Per', 'Total']],
      body: statsData,
      headStyles: { fillColor: [20, 20, 20] },
      styles: { fontSize: 8 }
    });

    doc.save(`Auditoria_Reemplazos_${new Date().toLocaleDateString()}.pdf`);
  };

  return (
    <div className="p-4 lg:p-8 max-w-6xl mx-auto space-y-12 min-h-screen">
      {/* Search Header */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-5xl font-serif text-stone-900 tracking-tighter uppercase italic font-black">Reportes</h2>
            <p className="text-stone-400 font-bold tracking-widest text-[10px] uppercase bg-stone-50 px-3 py-1 rounded-full border border-stone-100 inline-block">
              Monitoreo y Auditoría Académica
            </p>
          </div>
          
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
             <div className="flex items-center gap-2 bg-stone-50 px-4 py-2 rounded-xl border border-stone-100">
                <Calendar className="w-4 h-4 text-stone-400" />
                <div className="flex items-center gap-1">
                   <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="bg-transparent text-[10px] font-bold outline-none uppercase"
                   />
                   <span className="text-[10px] text-stone-300 font-black">—</span>
                   <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="bg-transparent text-[10px] font-bold outline-none uppercase"
                   />
                </div>
                {(startDate || endDate) && (
                   <button 
                      onClick={() => { setStartDate(''); setEndDate(''); }}
                      className="ml-2 text-stone-400 hover:text-red-500 transition-colors"
                   >
                      <X className="w-3 h-3" />
                   </button>
                )}
             </div>

             <button 
               onClick={activeTab === 'replacements' ? downloadReplacementsPDF : downloadTeacherReportsPDF}
               className="flex items-center justify-center gap-2 px-8 py-4 bg-bordeaux text-white rounded-2xl font-black hover:bg-bordeaux-dark transition-all shadow-2xl active:scale-95 group"
             >
               <FileDown className="w-5 h-5 group-hover:bounce" />
               <span className="text-[10px] uppercase tracking-widest">Descargar informe</span>
             </button>
          </div>
        </div>

        <div className="flex border-b border-stone-200 gap-8 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: 'Todos' },
            { id: 'weekday', label: 'Lunes-Viernes' },
            { id: 'saturday', label: 'Sábados' },
            { id: 'custom', label: 'Personalizadas' },
            { id: 'replacements', label: 'Class Reports Remplazos' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "pb-4 text-[10px] font-black uppercase tracking-widest transition-all relative",
                activeTab === tab.id ? "text-stone-900" : "text-stone-400 hover:text-stone-600"
              )}
            >
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-bordeaux" />
              )}
            </button>
          ))}
        </div>

        <div className="relative group max-w-2xl">
          <div className="relative">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-300 group-focus-within:text-bordeaux transition-colors" />
            <input 
              type="text" 
              placeholder="Buscar profesor para ver perfil de reportes..."
              value={teacherSearch}
              onChange={e => {
                setTeacherSearch(e.target.value);
                if (selectedTeacher && e.target.value !== selectedTeacher.displayName) {
                  setSelectedTeacher(null);
                }
              }}
              className="w-full pl-14 pr-6 py-5 rounded-[2rem] border-2 border-stone-100 focus:ring-8 focus:ring-bordeaux/5 focus:border-bordeaux outline-none text-base font-bold shadow-sm transition-all"
            />
          </div>

          {teacherSearch && !selectedTeacher && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-3xl border border-stone-100 shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="max-h-[300px] overflow-y-auto">
                {teachers.filter(t => 
                  t.displayName.toLowerCase().includes(teacherSearch.toLowerCase()) || 
                  t.email.toLowerCase().includes(teacherSearch.toLowerCase())
                ).map(teacher => (
                  <button
                    key={teacher.uid}
                    onClick={() => {
                      setSelectedTeacher(teacher);
                      setTeacherSearch(teacher.displayName);
                    }}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-stone-50 transition-colors border-b border-stone-50 last:border-0 group/item"
                  >
                    <div className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center border border-stone-200 group-hover/item:border-bordeaux transition-colors">
                      <UserIcon className="w-5 h-5 text-stone-400 group-hover/item:text-bordeaux" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-stone-900 group-hover/item:text-bordeaux transition-colors">{teacher.displayName}</p>
                      <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest">{teacher.email}</p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-stone-200 ml-auto group-hover/item:text-bordeaux transition-all group-hover/item:translate-x-1" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {activeTab === 'replacements' ? (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
           {/* Summary of replacements */}
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.values(replacementStats).map((tStat) => (
                 <div key={tStat.teacherName} className="bg-white p-6 rounded-[2rem] border-2 border-stone-100 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-stone-50 rotate-45 translate-x-8 -translate-y-8 transition-transform group-hover:bg-amber-500/5" />
                    <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-widest mb-3 truncate pr-4">{tStat.teacherName}</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <p className="text-[8px] font-black text-emerald-400 uppercase tracking-widest">Reg</p>
                          <p className="text-xl font-serif italic font-black text-stone-800">{tStat.regular}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">Ace</p>
                          <p className="text-xl font-serif italic font-black text-stone-800">{tStat.accelerated}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-black text-blue-400 uppercase tracking-widest">Sab</p>
                          <p className="text-xl font-serif italic font-black text-stone-800">{tStat.saturday}</p>
                       </div>
                       <div className="space-y-1">
                          <p className="text-[8px] font-black text-stone-300 uppercase tracking-widest">Per</p>
                          <p className="text-xl font-serif italic font-black text-stone-800">{tStat.personalized}</p>
                       </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-stone-50 flex items-center justify-between">
                       <span className="text-[8px] font-black text-stone-300 uppercase tracking-widest">Acumulado</span>
                       <span className="text-sm font-black text-stone-900 italic">{tStat.total} clases</span>
                    </div>
                 </div>
              ))}
           </div>

           {/* Table of replacements */}
           <div className="bg-white rounded-[2rem] border-2 border-stone-900 shadow-2xl overflow-hidden overflow-x-auto border-b-8 border-b-black">
              <table className="w-full border-collapse">
                 <thead className="bg-bordeaux text-white uppercase text-[9px] font-black tracking-widest">
                    <tr>
                       <th className="px-4 py-5 border-r border-stone-700 text-left">Docente que Reemplaza</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-left">Docente Reemplazado</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-left">Nivel</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-center">Regular</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-center">Acelerado</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-center">Sábados</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-left">Horario</th>
                       <th className="px-4 py-5 border-r border-stone-700 text-left">Fecha</th>
                       <th className="px-4 py-5 text-left">Avance</th>
                    </tr>
                 </thead>
                 <tbody className="text-[11px] font-bold text-stone-800 divide-y divide-stone-100">
                    {filteredReplacements.map((r) => (
                       <tr key={r.id} className="hover:bg-stone-50 transition-colors">
                          <td className="px-4 py-4 border-r border-stone-100 font-black">{r.replacingTeacherName}</td>
                          <td className="px-4 py-4 border-r border-stone-100 text-stone-500 italic">{r.replacedTeacherName}</td>
                          <td className="px-4 py-4 border-r border-stone-100 uppercase tracking-wider">{r.classLevel}</td>
                          <td className="px-4 py-4 border-r border-stone-100 text-center">
                             {r.classType === 'Regular' && <div className="w-4 h-4 bg-emerald-500 rounded-sm mx-auto shadow-sm" />}
                          </td>
                          <td className="px-4 py-4 border-r border-stone-100 text-center">
                             {r.classType === 'Acelerado' && <div className="w-4 h-4 bg-indigo-500 rounded-sm mx-auto shadow-sm" />}
                          </td>
                          <td className="px-4 py-4 border-r border-stone-100 text-center">
                             {r.classType === 'Sábados' && <div className="w-4 h-4 bg-blue-500 rounded-sm mx-auto shadow-sm" />}
                          </td>
                          <td className="px-4 py-4 border-r border-stone-100 font-mono tracking-tighter">{r.schedule}</td>
                          <td className="px-4 py-4 border-r border-stone-100 text-stone-400">{r.date?.toDate?.()?.toLocaleDateString()}</td>
                          <td className="px-4 py-4 italic text-stone-600 line-clamp-2 max-w-xs">{r.progressReport}</td>
                       </tr>
                    ))}
                    {filteredReplacements.length === 0 && (
                       <tr>
                          <td colSpan={9} className="px-4 py-24 text-center">
                             <div className="space-y-4">
                                <Users className="w-12 h-12 text-stone-100 mx-auto" />
                                <p className="text-stone-300 font-black uppercase tracking-[0.4em] text-[9px]">No se encontraron auditorías de reemplazo en este periodo</p>
                             </div>
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>
        </div>
      ) : selectedTeacher ? (
        <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Teacher Profile Summary */}
          <div className="bg-white rounded-[3rem] border border-stone-100 p-10 shadow-2xl shadow-stone-200/40 border-b-4 border-b-black">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
               <div className="lg:col-span-4 flex flex-col items-center lg:items-start gap-6 border-b lg:border-b-0 lg:border-r border-stone-100 pb-8 lg:pb-0 lg:pr-12">
                  <div className="w-32 h-32 bg-stone-50 rounded-full flex items-center justify-center border-4 border-dashed border-stone-200 group relative">
                    <UserIcon className="w-16 h-16 text-stone-300 group-hover:scale-110 transition-transform" />
                    <div className="absolute -bottom-2 -right-2 bg-emerald-500 p-2 rounded-full border-4 border-white shadow-lg">
                       <CheckCircle className="w-6 h-6 text-white" />
                    </div>
                  </div>
                  <div className="text-center lg:text-left space-y-2">
                    <h3 className="text-4xl font-serif font-black text-stone-900 italic tracking-tighter">{selectedTeacher.displayName}</h3>
                    <p className="text-stone-400 font-bold uppercase tracking-[0.2em] text-[10px]">Facilitador de Idiomas</p>
                    <div className="pt-4 flex flex-col gap-3">
                       {selectedTeacher.email && (
                          <div className="flex items-center gap-3 text-stone-500 font-medium text-xs">
                             <div className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center border border-stone-100">
                                <Mail className="w-3.5 h-3.5 text-stone-400" />
                             </div>
                             {selectedTeacher.email}
                          </div>
                       )}
                       {selectedTeacher.phoneNumber && (
                          <div className="flex items-center gap-3 text-stone-500 font-medium text-xs">
                             <div className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center border border-stone-100">
                                <Phone className="w-3.5 h-3.5 text-stone-400" />
                             </div>
                             {selectedTeacher.phoneNumber}
                          </div>
                       )}
                       {selectedTeacher.specialty && (
                          <div className="flex items-center gap-3 text-stone-500 font-medium text-xs">
                             <div className="w-7 h-7 rounded-lg bg-stone-50 flex items-center justify-center border border-stone-100" title="Specialty">
                                <Award className="w-3.5 h-3.5 text-stone-400" />
                             </div>
                             {selectedTeacher.specialty}
                          </div>
                       )}
                    </div>
                  </div>
               </div>

               <div className="lg:col-span-8 flex flex-col gap-10">
                  <div className="flex flex-wrap items-center justify-between gap-6">
                    <div className="space-y-1">
                      <p className="text-[10px] font-black text-stone-400 uppercase tracking-[0.2em]">Rendimiento Académico</p>
                      <h4 className="text-2xl font-bold text-stone-900">Métricas Consolidadas</h4>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="w-3 h-3 rounded-full bg-emerald-500" />
                       <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">Estado: Activo</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     {[
                       { label: 'Regular', icon: Clock, count: stats.regular, color: 'bg-emerald-50 text-emerald-600' },
                       { label: 'Acelerada', icon: Award, count: stats.accelerated, color: 'bg-indigo-50 text-indigo-600' },
                       { label: 'Sábados', icon: Calendar, count: stats.saturday, color: 'bg-blue-50 text-blue-600' },
                       { label: 'Personaliz.', icon: BookOpen, count: stats.custom, color: 'bg-amber-50 text-amber-600' },
                       { label: 'Total', icon: FileDown, count: stats.total, color: 'bg-bordeaux text-white' }
                     ].map((metric, i) => (
                       <div key={i} className="bg-stone-50/50 p-6 rounded-[2rem] border border-stone-100 relative group overflow-hidden">
                          <metric.icon className={cn("w-12 h-12 absolute -right-2 -bottom-2 opacity-5", metric.color)} />
                          <p className="text-[9px] font-black uppercase tracking-widest text-stone-400 mb-2">{metric.label}</p>
                          <p className="text-3xl font-serif italic font-black text-stone-900">{metric.count}</p>
                       </div>
                     ))}
                  </div>
               </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] border-2 border-stone-900 shadow-2xl overflow-hidden overflow-x-auto border-b-8 border-b-black">
            <table className="w-full border-collapse">
              <thead className="bg-stone-900 text-white uppercase text-[9px] font-black tracking-widest">
                <tr>
                  <th className="px-4 py-5 border-r border-stone-700 text-left">Fecha</th>
                  <th className="px-4 py-5 border-r border-stone-700 text-left">Curso</th>
                  <th className="px-4 py-5 border-r border-stone-700 text-left">Tipo</th>
                  <th className="px-4 py-5 border-r border-stone-700 text-center">Horas</th>
                  <th className="px-4 py-5 border-r border-stone-700 text-left">Estado</th>
                  <th className="px-4 py-5 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="text-[11px] font-bold text-stone-800 divide-y divide-stone-100">
                {(() => {
                  const reportsByMonthAdmin = filteredReports.reduce((acc, report) => {
                    const m = report.month || 'Otro';
                    const monthName = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
                    if (!acc[monthName]) acc[monthName] = [];
                    acc[monthName].push(report);
                    return acc;
                  }, {} as Record<string, ClassReport[]>);

                  return Object.entries(reportsByMonthAdmin).map(([month, monthReports]) => (
                    <React.Fragment key={month}>
                      <tr className="bg-stone-50 text-[10px] uppercase font-black tracking-widest text-stone-500">
                        <td colSpan={6} className="px-5 py-3 border-b border-stone-200 bg-stone-100/70 italic text-stone-600 font-bold">
                          Mes: {month}
                        </td>
                      </tr>
                      {monthReports.map((report) => (
                        <tr key={report.id} className="hover:bg-stone-50/55 transition-colors cursor-pointer group/row" onClick={() => setSelectedReport(report)}>
                          <td className="px-4 py-4 border-r border-stone-100">{report.date?.toDate ? report.date?.toDate?.().toLocaleDateString() : new Date(report.date).toLocaleDateString()}</td>
                          <td className="px-4 py-4 border-r border-stone-100 font-black group-hover/row:text-bordeaux transition-colors">{report.courseName}</td>
                          <td className="px-4 py-4 border-r border-stone-100">
                            <span className="uppercase italic">{report.type === 'weekday' ? (report.isAccelerated ? 'Acelerado' : 'Regular') : (report.type === 'saturday' ? 'Sábado' : 'Personalizado')}</span>
                          </td>
                          <td className="px-4 py-4 border-r border-stone-100 text-center">{report.hours}h</td>
                          <td className="px-4 py-4 border-r border-stone-100">
                             <span className={cn(
                               "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                               report.status === 'approved' ? 'bg-emerald-100 text-emerald-700' : 
                               report.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                             )}>
                               {report.status}
                             </span>
                          </td>
                          <td className="px-4 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                             <div className="flex items-center justify-end gap-2">
                                {report.status !== 'approved' && (
                                  <button 
                                    onClick={() => handleStatusUpdate(report.id!, 'approved')}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                    title="Aprobar"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                )}
                                {report.status !== 'rejected' && (
                                  <button 
                                    onClick={() => handleStatusUpdate(report.id!, 'rejected')}
                                    className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors"
                                    title="Rechazar"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                             </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ));
                })()}
                {filteredReports.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-20 text-center text-stone-200">No se encontraron reportes para este profesor</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
          {teachers.filter(t => 
            t.displayName.toLowerCase().includes(teacherSearch.toLowerCase()) || 
            t.email.toLowerCase().includes(teacherSearch.toLowerCase())
          ).map(teacher => (
            <button
              key={teacher.uid}
              onClick={() => {
                setSelectedTeacher(teacher);
                setTeacherSearch(teacher.displayName);
              }}
              className="group bg-white p-10 rounded-[3rem] border border-stone-100 hover:border-stone-900 transition-all text-left relative overflow-hidden shadow-sm hover:shadow-2xl"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-stone-50 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-500" />
              <div className="relative">
                <div className="w-16 h-16 bg-bordeaux text-white rounded-3xl flex items-center justify-center mb-8 shadow-xl group-hover:rotate-6 transition-transform">
                  <UserIcon className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-serif font-black text-stone-900 mb-2 truncate italic">{teacher.displayName}</h3>
                <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-6">{teacher.email}</p>
                <div className="pt-6 border-t border-stone-50 flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-widest text-stone-300">Ver Auditoría</span>
                  <div className="w-10 h-10 rounded-2xl bg-stone-50 flex items-center justify-center group-hover:bg-bordeaux group-hover:text-white transition-all">
                    <ArrowRight className="w-5 h-5" />
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

    </div>
  );
};

export const TeacherReports = ({ type }: TeacherReportsProps) => {
  const { user, profile } = useAuth();
  const [reports, setReports] = useState<ClassReport[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ClassReport | null>(null);
  const [selectedCourseForReports, setSelectedCourseForReports] = useState<Course | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [reportId, setReportId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  
  const filteredCourses = courses.filter((course) => {
    if (type === 'weekday') {
      return !course.type || course.type === 'Regular' || course.type === 'Acelerado';
    } else if (type === 'saturday') {
      return course.type === 'Sábados';
    } else if (type === 'custom') {
      return course.type === 'Personalizadas';
    }
    return true;
  });

  const [formData, setFormData] = useState({
    courseId: '',
    courseName: '',
    date: new Date().toLocaleDateString('sv-SE'),
    startTime: '',
    endTime: '',
    hours: '',
    progress: '',
    isRegular: true,
    isAccelerated: false,
    comments: '',
    month: new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date()),
    startDate: '',
    endDate: '',
    level: '',
    schedule: '',
    grid: type === 'weekday' || type === 'custom'
      ? Array(25).fill(0).map(() => ({ date: '', page: '', content: '' })) 
      : Array(4).fill(0).map(() => ({ date: '', page: '', content: '' }))
  });

  useEffect(() => {
    if (!user || !profile) return;
    const isSpecialRole = ['master', 'admin', 'dir_acad'].includes(profile.role || '');
    const q = isSpecialRole
      ? query(collection(db, 'courses'))
      : query(collection(db, 'courses'), where('teacherId', '==', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCourses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Course)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'courses'));
    return () => unsubscribe();
  }, [user, profile]);

  // Auto-save logic
  useEffect(() => {
    if (!reportId || !isModalOpen) return;
    
    setIsSaving(true);
    const timeoutId = setTimeout(async () => {
      try {
        const reportRef = doc(db, 'classReports', reportId);
        await updateDoc(reportRef, {
          ...formData,
          updatedAt: new Date()
        });
        setIsSaving(false);
      } catch (error) {
        console.error('Error auto-saving report:', error);
        setIsSaving(false);
      }
    }, 2000); // 2 second debounce

    return () => clearTimeout(timeoutId);
  }, [formData, reportId, isModalOpen]);

  const loadOrCreateReport = async (courseId: string, monthName?: string) => {
    if (!user || !profile) return;
    
    const course = courses.find(c => c.id === courseId);
    if (!course) return;

    const currentMonth = monthName || new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date());
    
    // Check if report exists for this month and course
    const existingReport = reports.find(r => 
      r.courseId === courseId && 
      r.type === type && 
      r.month?.toLowerCase() === currentMonth.toLowerCase()
    );

    if (existingReport) {
      setReportId(existingReport.id!);
      setFormData({
        courseId: existingReport.courseId || courseId,
        courseName: existingReport.courseName || course.name,
        date: existingReport.date?.toDate ? existingReport.date.toDate().toLocaleDateString('sv-SE') : (existingReport.date || new Date().toLocaleDateString('sv-SE')),
        startTime: existingReport.startTime || '',
        endTime: existingReport.endTime || '',
        hours: existingReport.hours || '',
        progress: existingReport.progress || '',
        isRegular: existingReport.isRegular ?? (course.type === 'Regular'),
        isAccelerated: existingReport.isAccelerated ?? (course.type === 'Acelerado'),
        comments: existingReport.comments || '',
        month: existingReport.month || currentMonth,
        startDate: existingReport.startDate || course.startDate || '',
        endDate: existingReport.endDate || course.endDate || '',
        level: existingReport.level || course.level || '',
        schedule: existingReport.schedule || course.schedule || '',
        grid: existingReport.grid || (type === 'weekday' || type === 'custom'
          ? Array(25).fill(0).map(() => ({ date: '', page: '', content: '' })) 
          : Array(4).fill(0).map(() => ({ date: '', page: '', content: '' })))
      });
      setIsModalOpen(true);
    } else {
      // Create new draft report
      try {
        const initialGrid = type === 'weekday' || type === 'custom'
          ? Array(25).fill(0).map(() => ({ date: '', page: '', content: '' })) 
          : Array(4).fill(0).map(() => ({ date: '', page: '', content: '' }));

        const newReport: Omit<ClassReport, 'id'> = {
          teacherId: user.uid,
          teacherName: profile.displayName,
          courseId,
          courseName: course.name,
          type,
          status: 'pending',
          month: currentMonth,
          startDate: course.startDate || '',
          endDate: course.endDate || '',
          level: course.level || '',
          schedule: course.schedule || '',
          isRegular: course.type === 'Regular',
          isAccelerated: course.type === 'Acelerado',
          grid: initialGrid,
          date: new Date(),
          createdAt: new Date(),
          progress: ''
        };

        const docRef = await addDoc(collection(db, 'classReports'), newReport);
        setReportId(docRef.id);
        setFormData({
          courseId,
          courseName: course.name,
          date: new Date().toLocaleDateString('sv-SE'),
          startTime: '',
          endTime: '',
          hours: '',
          progress: '',
          isRegular: course.type === 'Regular',
          isAccelerated: course.type === 'Acelerado',
          comments: '',
          month: currentMonth,
          startDate: course.startDate || '',
          endDate: course.endDate || '',
          level: course.level || '',
          schedule: course.schedule || '',
          grid: initialGrid
        });
        setIsModalOpen(true);
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'classReports');
      }
    }
  };

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'classReports'), 
      where('teacherId', '==', user.uid),
      where('type', '==', type),
      orderBy('date', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ClassReport)));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'classReports'));
    return () => unsubscribe();
  }, [user, type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile || !reportId) return;
    setIsSubmitting(true);
    try {
      const reportRef = doc(db, 'classReports', reportId);
      await updateDoc(reportRef, {
        ...formData,
        status: 'submitted',
        updatedAt: new Date()
      });
      
      setIsModalOpen(false);
      setReportId(null);
      alert('Reporte enviado y guardado correctamente.');
    } catch (error) {
       handleFirestoreError(error, OperationType.WRITE, 'classReports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGridChange = (index: number, field: string, value: string) => {
    const newGrid = [...formData.grid];
    newGrid[index] = { ...newGrid[index], [field]: value };
    setFormData({ ...formData, grid: newGrid });
  };

  const weekdays = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'];

  if (selectedReport) {
    return (
      <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
        <button 
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-stone-400 hover:text-stone-900 font-black uppercase tracking-widest text-[10px] transition-colors no-print"
        >
          <X className="w-4 h-4" />
          Volver al listado
        </button>
        <div className="bg-white rounded-[2rem] border-2 border-stone-900 shadow-2xl p-8 border-b-8 border-b-black">
          <div className="mb-6 flex justify-end gap-3 no-print">
            {['master', 'admin', 'dir_acad'].includes(profile?.role || '') && (
              <button
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-stone-950 hover:bg-stone-800 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-md"
              >
                <Printer className="w-4 h-4" />
                Imprimir Reporte
              </button>
            )}
            <button
              onClick={() => downloadSingleClassReportPDF(selectedReport)}
              className="px-5 py-2.5 bg-red-900 hover:bg-red-950 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center gap-2 shadow-md"
            >
              <FileDown className="w-4 h-4" />
              Descargar PDF
            </button>
          </div>
          <ReportDetailView report={selectedReport} onClose={() => setSelectedReport(null)} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-8 max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
           <h2 className="text-4xl font-serif text-stone-900 tracking-tighter uppercase italic font-black">
             {type === 'weekday' ? 'Reporte Lunes-Viernes' : type === 'saturday' ? 'Reporte Sábados' : 'Reporte Personalizado'}
           </h2>
           <p className="text-stone-500 font-bold">Tus cursos asignados para el reporte de progreso.</p>
        </div>
        {isModalOpen && (
          <button 
             onClick={() => setIsModalOpen(false)}
             className="flex items-center justify-center gap-3 px-10 py-5 rounded-[2rem] font-black uppercase tracking-widest text-xs transition-all shadow-2xl bg-stone-900 text-white"
          >
            <X className="w-5 h-5" />
            Cerrar Reporte
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!isModalOpen ? (
          !selectedCourseForReports ? (
            <motion.div 
              key="courses-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
            >
              {filteredCourses.length > 0 ? (
                filteredCourses.map((course) => (
                  <div 
                    key={course.id}
                    className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-black"
                  >
                    <div className="flex items-center justify-between mb-6">
                      <div className="px-3 py-1 bg-stone-50 text-stone-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-stone-100">
                        {course.schedule}
                      </div>
                      <BookOpen className="w-5 h-5 text-bordeaux opacity-20 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <h3 className="text-2xl font-serif font-black text-stone-900 mb-2 truncate italic">{course.name}</h3>
                    <div className="flex flex-col gap-1 mb-8">
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Nivel: {course.level}</p>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest">Tipo: {course.type || 'Regular'}</p>
                    </div>
                    
                    <button
                      onClick={() => setSelectedCourseForReports(course)}
                      className="w-full flex items-center justify-between gap-4 px-6 py-4 bg-stone-50 hover:bg-bordeaux hover:text-white rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all group/btn"
                    >
                      <span>IR A REPORTES</span>
                      <ArrowRight className="w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
                    </button>
                  </div>
                ))
              ) : (
                <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-stone-100 italic text-stone-400">
                  No tienes cursos asignados actualmente.
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="months-selection"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSelectedCourseForReports(null)}
                  className="flex items-center gap-2 text-stone-400 hover:text-stone-950 font-black uppercase tracking-widest text-[10px] transition-colors"
                >
                  <ArrowRight className="w-4 h-4 rotate-180" />
                  Volver a Cursos
                </button>
                <span className="text-[10px] bg-bordeaux/10 text-bordeaux px-4 py-1.5 rounded-full font-black uppercase tracking-widest border border-bordeaux/20">
                  Curso: {selectedCourseForReports.name}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {[
                  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                ].map((monthName) => {
                  const existingReport = reports.find(r => 
                    r.courseId === selectedCourseForReports.id &&
                    r.type === type &&
                    r.month?.toLowerCase() === monthName.toLowerCase()
                  );

                  return (
                    <div 
                      key={monthName}
                      className="bg-white p-6 rounded-[2rem] border border-stone-150 shadow-sm flex flex-col justify-between min-h-[180px] hover:shadow-md transition-all border-b-4 border-b-black"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-xl font-serif font-black italic text-stone-900">{monthName}</h4>
                          {existingReport ? (
                            <span className={cn(
                              "w-2.5 h-2.5 rounded-full",
                              existingReport.status === 'approved' ? 'bg-emerald-500' :
                              existingReport.status === 'rejected' ? 'bg-red-500' : 'bg-amber-500'
                            )} title={existingReport.status} />
                          ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-stone-200" title="No iniciado" />
                          )}
                        </div>
                        
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-widest mb-4">
                          {existingReport 
                            ? `Estado: ${existingReport.status === 'approved' ? 'Aprobado' : existingReport.status === 'rejected' ? 'Rechazado' : 'Pendiente'}`
                            : 'Estado: No Iniciado'
                          }
                        </p>
                      </div>

                      {existingReport ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => setSelectedReport(existingReport)}
                            className="flex-1 py-2.5 bg-stone-900 hover:bg-stone-950 text-white rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-colors animate-in fade-in"
                          >
                            Ver Reporte
                          </button>
                          {existingReport.status !== 'approved' && (
                            <button
                              onClick={() => {
                                setReportId(existingReport.id!);
                                setFormData({
                                  courseId: existingReport.courseId || selectedCourseForReports.id,
                                  courseName: existingReport.courseName || selectedCourseForReports.name,
                                  date: existingReport.date?.toDate ? existingReport.date.toDate().toLocaleDateString('sv-SE') : (existingReport.date || new Date().toLocaleDateString('sv-SE')),
                                  startTime: existingReport.startTime || '',
                                  endTime: existingReport.endTime || '',
                                  hours: existingReport.hours || '',
                                  progress: existingReport.progress || '',
                                  isRegular: existingReport.isRegular ?? (selectedCourseForReports.type === 'Regular'),
                                  isAccelerated: existingReport.isAccelerated ?? (selectedCourseForReports.type === 'Acelerado'),
                                  comments: existingReport.comments || '',
                                  month: existingReport.month || monthName,
                                  startDate: existingReport.startDate || selectedCourseForReports.startDate || '',
                                  endDate: existingReport.endDate || selectedCourseForReports.endDate || '',
                                  level: existingReport.level || selectedCourseForReports.level || '',
                                  schedule: existingReport.schedule || selectedCourseForReports.schedule || '',
                                  grid: existingReport.grid || (type === 'weekday' || type === 'custom'
                                    ? Array(25).fill(0).map(() => ({ date: '', page: '', content: '' })) 
                                    : Array(4).fill(0).map(() => ({ date: '', page: '', content: '' })))
                                });
                                setIsModalOpen(true);
                              }}
                              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-stone-950 rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-colors"
                            >
                              Editar
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => loadOrCreateReport(selectedCourseForReports.id, monthName)}
                          className="w-full py-2.5 bg-stone-100 hover:bg-bordeaux hover:text-white text-stone-700 rounded-xl text-[9px] font-black uppercase tracking-widest text-center transition-all"
                        >
                          Crear Reporte
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )
        ) : (
          <motion.div 
            key="report-form"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="overflow-hidden"
          >
            <div className="bg-white border-2 border-stone-900 p-8 mb-12 font-sans text-stone-900">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn("w-2 h-2 rounded-full", isSaving ? "bg-amber-500 animate-pulse" : "bg-emerald-500")} />
                  <span className="text-[9px] font-bold uppercase tracking-widest text-stone-400">
                    {isSaving ? 'Guardando cambios automáticamente...' : 'Todos los cambios guardados'}
                  </span>
                </div>
              </div>
              <div className="relative mb-6">
                <div className="absolute top-0 right-0">
                  <img src={LOGO_URL} alt="Logo" className="h-20" />
                </div>
                <h2 className="text-3xl font-bold text-center uppercase tracking-normal mb-8 pt-4">
                  {type === 'weekday' ? 'WEEKDAY CLASS REPORT' : type === 'saturday' ? 'SATURDAY CLASS REPORT' : 'CLASS PROGRESS REPORT'}
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr_1.2fr_0.8fr] gap-x-12 gap-y-3 text-[13px]">
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <span className="font-bold whitespace-nowrap min-w-[70px] md:min-w-0 text-stone-500">Facilitator:</span>
                         <span className="flex-1 border-b border-stone-900 min-h-[20px] px-1 font-bold">{profile?.displayName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="font-bold whitespace-nowrap min-w-[70px] md:min-w-0 text-stone-500">Schedule:</span>
                         <input 
                            type="text" 
                            className="flex-1 border-b border-stone-900 bg-transparent outline-none px-1 font-bold focus:bg-stone-50 transition-colors" 
                            value={formData.schedule} 
                            onChange={e => setFormData({...formData, schedule: e.target.value})} 
                         />
                      </div>
                   </div>
 
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <span className="font-bold whitespace-nowrap min-w-[70px] md:min-w-0 text-stone-500">Level:</span>
                         <input 
                            type="text" 
                            className="flex-1 border-b border-stone-900 bg-transparent outline-none px-1 font-bold focus:bg-stone-50 transition-colors" 
                            value={formData.level} 
                            onChange={e => setFormData({...formData, level: e.target.value})} 
                         />
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="font-bold whitespace-nowrap min-w-[70px] md:min-w-0 text-stone-500">Month:</span>
                         <input 
                            type="text" 
                            className="flex-1 border-b border-stone-900 bg-transparent outline-none px-1 font-bold focus:bg-stone-50 transition-colors" 
                            value={formData.month} 
                            onChange={e => setFormData({...formData, month: e.target.value})} 
                         />
                      </div>
                   </div>
 
                   <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                         <span className="font-bold whitespace-nowrap min-w-[70px] md:min-w-0 text-stone-500">Start Date:</span>
                         <input 
                            type="text" 
                            className="flex-1 border-b border-stone-900 bg-transparent outline-none px-1 font-bold focus:bg-stone-50 transition-colors" 
                            value={formData.startDate} 
                            onChange={e => setFormData({...formData, startDate: e.target.value})} 
                         />
                      </div>
                      <div className="flex items-center gap-2">
                         <span className="font-bold whitespace-nowrap min-w-[70px] md:min-w-0 text-stone-500">End Date:</span>
                         <input 
                            type="text" 
                            className="flex-1 border-b border-stone-900 bg-transparent outline-none px-1 font-bold focus:bg-stone-50 transition-colors" 
                            value={formData.endDate} 
                            onChange={e => setFormData({...formData, endDate: e.target.value})} 
                         />
                      </div>
                   </div>
 
                   <div className="flex flex-row md:flex-col gap-4 md:gap-1 mt-2 md:mt-0 justify-between md:justify-start">
                      <div className="flex items-center justify-between gap-4 flex-1">
                         <span className="font-bold whitespace-nowrap text-stone-500">Regular:</span>
                         <button 
                            type="button"
                            className="w-6 h-6 border-2 border-stone-900 flex items-center justify-center cursor-pointer bg-white shadow-sm hover:bg-stone-50 transition-colors"
                            onClick={() => setFormData({...formData, isRegular: !formData.isRegular, isAccelerated: formData.isRegular})}
                         >
                            {formData.isRegular && <div className="w-4 h-4 bg-stone-700" />}
                         </button>
                      </div>
                      <div className="flex items-center justify-between gap-4 flex-1">
                         <span className="font-bold whitespace-nowrap text-stone-500">Accelerated:</span>
                         <button 
                            type="button"
                            className="w-6 h-6 border-2 border-stone-900 flex items-center justify-center cursor-pointer bg-white shadow-sm hover:bg-stone-50 transition-colors"
                            onClick={() => setFormData({...formData, isAccelerated: !formData.isAccelerated, isRegular: formData.isAccelerated})}
                         >
                            {formData.isAccelerated && <div className="w-4 h-4 bg-stone-700" />}
                         </button>
                      </div>
                   </div>
                </div>

                <div className="mt-4">
                   <select 
                      value={formData.courseId} 
                      onChange={e => {
                        const courseId = e.target.value;
                        const course = courses.find(c => c.id === courseId);
                        if (course) {
                          setFormData({
                            ...formData,
                            courseId,
                            courseName: course.name,
                            level: course.level || '',
                            schedule: course.schedule || '',
                            startDate: course.startDate || '',
                            endDate: course.endDate || '',
                            isRegular: course.type === 'Regular',
                            isAccelerated: course.type === 'Acelerado'
                          });
                        } else {
                          setFormData({...formData, courseId});
                        }
                      }}
                      required
                      className="text-[10px] uppercase tracking-widest font-black text-stone-900 bg-stone-50 border-2 border-stone-900 rounded-xl px-4 py-2 outline-none shadow-sm cursor-pointer"
                   >
                      <option value="">Seleccionar curso para cargar datos...</option>
                      {filteredCourses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} - {c.level || ''} ({c.schedule || ''})
                        </option>
                      ))}
                   </select>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-8">
                {type === 'weekday' || type === 'custom' ? (
                  <div className="border-[1.5px] border-stone-900 overflow-x-auto no-scrollbar shadow-sm">
                    <div className="min-w-[800px] flex flex-col bg-white">
                      <div className="grid grid-cols-5 border-b-[1.5px] border-stone-900">
                        {weekdays.map(day => (
                          <div key={day} className="py-1 text-center text-[12px] font-bold border-r-[1.5px] last:border-0 border-stone-900 uppercase bg-stone-50/50">
                            {day}
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-5 divide-x-[1.5px] divide-stone-900">
                        {weekdays.map((day, dayIdx) => (
                          <div key={dayIdx} className="flex flex-col divide-y-[1.5px] divide-stone-900">
                            {Array(5).fill(0).map((_, weekIdx) => {
                              const itemIdx = weekIdx * 5 + dayIdx;
                              return (
                                <div key={itemIdx} className="flex flex-col min-h-[160px] group focus-within:bg-stone-50/50 transition-colors">
                                  <textarea 
                                    className="flex-1 w-full text-[12px] font-bold leading-tight outline-none resize-none bg-transparent p-2.5 placeholder:text-stone-300"
                                    placeholder="..."
                                    value={formData.grid[itemIdx].content}
                                    onChange={e => handleGridChange(itemIdx, 'content', e.target.value)}
                                  />
                                  <div className="border-t-[1.5px] border-stone-900 grid grid-cols-[auto_1fr_auto_1fr] text-[10px] items-center">
                                    <span className="px-1.5 border-r-[1.5px] border-stone-900 font-bold py-1.5 bg-stone-50/30">Date:</span>
                                    <input 
                                      type="text" 
                                      className="w-full bg-transparent outline-none px-1.5 border-r-[1.5px] border-stone-900 py-1.5" 
                                      value={formData.grid[itemIdx].date}
                                      onChange={e => handleGridChange(itemIdx, 'date', e.target.value)}
                                    />
                                    <span className="px-1.5 border-r-[1.5px] border-stone-900 font-bold py-1.5 bg-stone-50/30">Page:</span>
                                    <input 
                                      type="text" 
                                      className="w-full bg-transparent outline-none px-1.5 py-1.5" 
                                      value={formData.grid[itemIdx].page}
                                      onChange={e => handleGridChange(itemIdx, 'page', e.target.value)}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="border-[1.5px] border-stone-900 overflow-x-auto no-scrollbar shadow-sm">
                    <div className="min-w-[800px] flex flex-col bg-white">
                      <div className="grid grid-cols-4 border-b-[1.5px] border-stone-900">
                        {Array(4).fill(0).map((_, idx) => (
                          <div key={idx} className="py-2 text-center text-[12px] font-bold border-r-[1.5px] last:border-0 border-stone-900 uppercase bg-stone-50/50">SATURDAY</div>
                        ))}
                      </div>
                      <div className="grid grid-cols-4 divide-x-[1.5px] divide-stone-900">
                        {Array(4).fill(0).map((_, idx) => (
                          <div key={idx} className="flex flex-col min-h-[350px] focus-within:bg-stone-50/50 transition-colors">
                            <textarea 
                              className="flex-1 w-full text-xs font-bold leading-relaxed outline-none resize-none bg-transparent p-4 italic placeholder:text-stone-300"
                              placeholder="Resumen de la sesión del sábado..."
                              value={formData.grid[idx]?.content}
                              onChange={e => handleGridChange(idx, 'content', e.target.value)}
                            />
                            <div className="border-t-[1.5px] border-stone-900 grid grid-cols-[auto_1fr_auto_1fr] text-[10px] items-center">
                              <span className="px-2 border-r-[1.5px] border-stone-900 font-bold py-2.5 bg-stone-50/30">Date:</span>
                              <input 
                                type="text" 
                                className="w-full bg-transparent outline-none px-1.5 border-r-[1.5px] border-stone-900 py-2.5 uppercase" 
                                value={formData.grid[idx]?.date} 
                                onChange={e => handleGridChange(idx, 'date', e.target.value)} 
                              />
                              <span className="px-2 border-r-[1.5px] border-stone-900 font-bold py-2.5 bg-stone-50/30">Page:</span>
                              <input 
                                type="text" 
                                className="w-full bg-transparent outline-none px-1.5 py-2.5" 
                                value={formData.grid[idx]?.page} 
                                onChange={e => handleGridChange(idx, 'page', e.target.value)} 
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center bg-white border-[1.5px] border-stone-900 border-t-0 -mt-[1.5px]">
                  <div className="flex items-center">
                     <div className="px-6 py-2 border-r-[1.5px] border-stone-900">
                        <span className="text-[12px] font-bold uppercase tracking-widest">TOTAL CLASES:</span>
                     </div>
                     <div className="w-20 flex items-center justify-center font-bold text-lg">
                        {formData.grid?.filter(i => i.content?.trim() !== '').length || 0}
                     </div>
                  </div>
                  <div className="pr-4 flex items-center gap-4">
                    {isSaving && (
                      <span className="text-[10px] font-bold text-stone-400 animate-pulse italic">Auto-guardando...</span>
                    )}
                    <button 
                      type="submit" 
                      disabled={isSubmitting}
                      className="px-8 py-2 bg-stone-900 text-white rounded font-black uppercase tracking-widest text-[10px] shadow-lg active:scale-95 disabled:opacity-50"
                    >
                      {isSubmitting ? 'Enviando...' : 'Finalizar y Entregar Reporte'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!isModalOpen && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <h3 className="text-lg font-serif font-black italic text-stone-900">Historial de Reportes Enviados</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {reports.map((report) => (
              <div 
                key={report.id} 
                onClick={() => {
                  if (report.status === 'approved') {
                    setSelectedReport(report);
                  } else {
                    // Load for editing
                    setReportId(report.id!);
                    setFormData({
                      courseId: report.courseId || '',
                      courseName: report.courseName || '',
                      date: report.date?.toDate ? report.date.toDate().toLocaleDateString('sv-SE') : (report.date || new Date().toLocaleDateString('sv-SE')),
                      startTime: report.startTime || '',
                      endTime: report.endTime || '',
                      hours: report.hours || '',
                      progress: report.progress || '',
                      isRegular: report.isRegular ?? true,
                      isAccelerated: report.isAccelerated ?? false,
                      comments: report.comments || '',
                      month: report.month || new Intl.DateTimeFormat('es-ES', { month: 'long' }).format(new Date()),
                      startDate: report.startDate || '',
                      endDate: report.endDate || '',
                      level: report.level || '',
                      schedule: report.schedule || '',
                      grid: report.grid || (type === 'weekday' 
                        ? Array(25).fill(0).map(() => ({ date: '', page: '', content: '' })) 
                        : type === 'saturday' 
                          ? Array(4).fill(0).map(() => ({ date: '', page: '', content: '' })) 
                          : Array(10).fill(0).map(() => ({ date: '', page: '', content: '' })))
                    });
                    setIsModalOpen(true);
                  }
                }}
                className="bg-white p-8 rounded-[2.5rem] border border-stone-100 shadow-sm hover:shadow-xl transition-all group border-b-4 border-b-black cursor-pointer"
              >
                <div className="flex items-center justify-between mb-6">
                   <div className="px-3 py-1 bg-stone-50 text-stone-400 rounded-lg text-[10px] font-black uppercase tracking-widest border border-stone-100">
                      {report.date?.toDate ? report.date?.toDate?.().toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : new Date(report.date).toLocaleDateString()}
                   </div>
                   <span className={cn(
                     "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                     report.status === 'approved' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                   )}>
                     {report.status}
                   </span>
                </div>
                <h4 className="text-xl font-bold text-stone-900 mb-2 truncate">{report.courseName}</h4>
                <div className="flex items-center gap-4 text-xs font-bold text-stone-400 mb-6 uppercase tracking-wider">
                   <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {report.hours}hs</span>
                   <span className="w-1 h-1 bg-stone-200 rounded-full" />
                   <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {report.grid?.length || 0} Clases</span>
                </div>
                <div className="space-y-3 mb-8">
                   {report.grid?.slice(0, 2).map((item, i) => (
                     <div key={i} className="flex gap-3 text-xs text-stone-500 italic">
                        <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                        <span className="truncate">{item.content}</span>
                     </div>
                   ))}
                   {report.grid && report.grid.length > 2 && <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest pl-7">+{report.grid.length - 2} actividades más</p>}
                </div>
              </div>
            ))}
            {reports.length === 0 && (
              <div className="col-span-full py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-stone-100 italic text-stone-400">
                 Todavía no has enviado reportes para esta categoría.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

// No internal ReportDetailView here, it was moved up

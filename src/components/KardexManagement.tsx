import React, { useState, useEffect } from 'react';
import { Search, FileDown, Printer, History, ClipboardList, CheckSquare } from 'lucide-react';
import { collection, onSnapshot, query, where, getDocs, orderBy } from 'firebase/firestore';
import { motion } from 'motion/react';
import jsPDF from 'jspdf';
import { db } from '../firebase';
import { LOGO_URL } from '../constants';
import { useCourses, useGrades, useTeachers, useUsers, useEnrollments } from '../hooks/useCollections';
import { UserProfile, Course, Grade, Enrollment } from '../types';
import { cn } from '../utils/cn';
import WorkAssessmentModal from './WorkAssessmentModal';

const KardexManagement = () => {
  const { data: allUsers } = useUsers();
  const { data: courses } = useCourses();
  const { data: allGrades } = useGrades();
  const { data: teachers } = useTeachers();
  const { data: enrollments } = useEnrollments();
  
  const [selectedStudent, setSelectedStudent] = useState<UserProfile | null>(null);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isWorkAssessmentOpen, setIsWorkAssessmentOpen] = useState(false);
  const [selectedAssessmentGrade, setSelectedAssessmentGrade] = useState<Grade | null>(null);
  const [studentGrades, setStudentGrades] = useState<Grade[]>([]);
  const [scheduleChanges, setScheduleChanges] = useState<any[]>([]);
  const [statusHistory, setStatusHistory] = useState<any[]>([]);

  const students = allUsers.filter(u => u.role === 'student');

  useEffect(() => {
    if (!selectedStudent) return;
    setLoading(true);

    const fetchKardexDetailData = async () => {
      try {
        let e: Enrollment | null = null;
        if (selectedStudent.studentCode) {
          const snap = await getDocs(query(collection(db, 'enrollments'), where('studentCode', '==', selectedStudent.studentCode)));
          if (snap.docs.length > 0) {
            e = { id: snap.docs[0].id, ...snap.docs[0].data() } as Enrollment;
          }
        }
        if (!e) {
          const snap = await getDocs(query(collection(db, 'enrollments'), where('studentEmail', '==', selectedStudent.email)));
          if (snap.docs.length > 0) {
            e = { id: snap.docs[0].id, ...snap.docs[0].data() } as Enrollment;
          }
        }
        setEnrollment(e);

        // Fetch schedule changes (by uid, code, or enrollment id)
        const scList: any[] = [];
        const scQueries = [
          getDocs(query(collection(db, 'scheduleChanges'), where('studentId', '==', selectedStudent.uid))),
          selectedStudent.studentCode ? getDocs(query(collection(db, 'scheduleChanges'), where('studentId', '==', selectedStudent.studentCode))) : null,
          e?.id ? getDocs(query(collection(db, 'scheduleChanges'), where('studentId', '==', e.id))) : null
        ].filter(Boolean);

        const scSnapshots = await Promise.all(scQueries);
        scSnapshots.forEach(snap => {
          if (snap) {
            snap.docs.forEach(doc => {
              const item = { id: doc.id, type: 'schedule', ...doc.data() };
              if (!scList.some(sc => sc.id === item.id)) {
                scList.push(item);
              }
            });
          }
        });

        // Fetch status history (by code, or uid)
        const shList: any[] = [];
        const shQueries = [
          selectedStudent.studentCode ? getDocs(query(collection(db, 'statusHistory'), where('studentId', '==', selectedStudent.studentCode))) : null,
          getDocs(query(collection(db, 'statusHistory'), where('studentId', '==', selectedStudent.uid)))
        ].filter(Boolean);

        const shSnapshots = await Promise.all(shQueries);
        shSnapshots.forEach(snap => {
          if (snap) {
            snap.docs.forEach(doc => {
              const item = { id: doc.id, type: 'status', ...doc.data() };
              if (!shList.some(sh => sh.id === item.id)) {
                shList.push(item);
              }
            });
          }
        });

        setScheduleChanges(scList);
        setStatusHistory(shList);
      } catch (err) {
        console.error("Error fetching Kardex detail data:", err);
      }
    };

    fetchKardexDetailData();

    // Filter grades for this student
    const grades = allGrades
      .filter(g => g.studentId === selectedStudent.uid)
      .sort((a, b) => (a.createdAt?.toMillis() || 0) - (b.createdAt?.toMillis() || 0));
    
    setStudentGrades(grades);
    setLoading(false);
  }, [selectedStudent, allGrades]);

  const generatePDF = async () => {
    if (!selectedStudent) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    let currentY = 15;

    const drawHeader = () => {
      // Logo
      try {
        doc.addImage(LOGO_URL, 'PNG', 15, currentY, 25, 25);
      } catch (e) {
        console.error("Error adding logo to PDF", e);
      }

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.text('Kardex-First Class Institute', pageWidth / 2 + 10, currentY + 15, { align: 'center' });

      currentY += 30;

      // Header Boxes
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      
      // Row 1: Names
      const lastName = enrollment?.lastName || selectedStudent.displayName.split(' ').slice(-2).join(' ');
      const firstName = enrollment?.firstName || selectedStudent.displayName.split(' ').slice(0, -2).join(' ');
      
      doc.text('Last Names:', 15, currentY + 5);
      doc.rect(40, currentY, 65, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(lastName, 42, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Name(s):', 110, currentY + 5);
      doc.rect(130, currentY, 65, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(firstName, 132, currentY + 5.5);

      currentY += 12;

      // Row 2: Address and Starting Date
      doc.setFont('helvetica', 'bold');
      doc.text('Address:', 15, currentY + 5);
      doc.rect(40, currentY, 65, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(enrollment?.address || '---', 42, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Starting Date:', 110, currentY + 5);
      doc.rect(140, currentY, 55, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(enrollment?.startDate || '---', 142, currentY + 5.5);

      currentY += 12;

      // Row 3: Starting Level and Initial Schedule
      doc.setFont('helvetica', 'bold');
      doc.text('Starting Level:', 15, currentY + 5);
      doc.rect(45, currentY, 60, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(enrollment?.level || '---', 47, currentY + 5.5);

      doc.setFont('helvetica', 'bold');
      doc.text('Initial Schedule:', 110, currentY + 5);
      doc.rect(140, currentY, 55, 8);
      doc.setFont('helvetica', 'normal');
      doc.text(enrollment?.schedule || enrollment?.shift || '---', 142, currentY + 5.5);

      currentY += 12;

      // Row 4: Placement Test and Code
      doc.setFont('helvetica', 'bold');
      doc.text('Placement test:', 15, currentY + 5);
      doc.text('YES', 45, currentY + 5);
      doc.rect(55, currentY, 6, 6);
      doc.text('NO', 70, currentY + 5);
      doc.rect(80, currentY, 6, 6);

      doc.text('Code:', 110, currentY + 5);
      doc.rect(130, currentY, 65, 8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text(selectedStudent.studentCode || '11054', 132, currentY + 6);

      currentY += 15;
      doc.setDrawColor(200, 200, 200);
      doc.line(15, currentY, pageWidth - 15, currentY);
      currentY += 10;
    };

    drawHeader();

    // Draw Grade Blocks
    studentGrades.forEach((g, index) => {
      if (currentY + 80 > pageHeight) {
        doc.addPage();
        currentY = 20;
        drawHeader();
      }

      const midtermTotal = g.midtermTotal || 0;
      const finalTotal = g.finalTotal || 0;
      const average = Math.round((midtermTotal + finalTotal) / 2);
      const pass = average >= 70;
      const teacher = teachers.find(t => t.uid === g.teacherId);

      // Block container
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.5);
      doc.rect(15, currentY, pageWidth - 30, 75);

      // Level, Date, Facilitator
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.text('Level:', 20, currentY + 10);
      doc.rect(35, currentY + 5, 25, 7);
      doc.setFont('helvetica', 'normal');
      doc.text(g.courseName.split(' ')[1] || g.courseName, 37, currentY + 10);

      doc.setFont('helvetica', 'bold');
      doc.text('Ending date:', 65, currentY + 10);
      doc.rect(85, currentY + 5, 30, 7);
      doc.setFont('helvetica', 'normal');
      doc.text(g.createdAt?.toDate().toLocaleDateString() || '---', 87, currentY + 10);

      doc.setFont('helvetica', 'bold');
      doc.text('Facilitator:', 120, currentY + 10);
      doc.rect(140, currentY + 5, 45, 7);
      doc.setFont('helvetica', 'normal');
      doc.text(teacher?.displayName || '---', 142, currentY + 10);

      currentY += 20;

      // Scores Row
      const scores = [
        { l: 'Attendance', v: g.finalAttendance },
        { l: 'Participation', v: g.finalParticipation },
        { l: 'Oral Eval.', v: g.finalOral },
        { l: 'Written Eval.', v: g.finalWritten },
        { l: 'Practices', v: g.finalPractices }
      ];

      let scoreX = 20;
      scores.forEach(s => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(s.l + ':', scoreX, currentY);
        doc.rect(scoreX + 18, currentY - 5, 10, 8);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        doc.text(s.v.toString(), scoreX + 20, currentY + 1);
        scoreX += 34;
      });

      currentY += 15;

      // Total Final, Pass/Fail
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('Total Final:', 20, currentY + 5);
      doc.rect(45, currentY, 30, 10);
      doc.setFontSize(14);
      doc.text(g.finalTotal.toString(), 52, currentY + 7);

      doc.setFontSize(9);
      doc.text('Pass:', 85, currentY + 5);
      doc.rect(98, currentY, 8, 8);
      if (pass) doc.text('X', 100, currentY + 6);

      doc.text('Fail:', 115, currentY + 5);
      doc.rect(128, currentY, 8, 8);
      if (!pass) doc.text('X', 130, currentY + 6);

      currentY += 15;

      // Observations
      doc.setFont('helvetica', 'bold');
      doc.text('Observations:', 20, currentY);
      doc.rect(20, currentY + 2, pageWidth - 40, 15);
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(8);
      doc.text(g.comments || '---', 25, currentY + 8, { maxWidth: pageWidth - 50 });

      currentY += 35; // Space for next block
    });

    // Save
    doc.save(`Kardex_${selectedStudent.displayName.replace(/\s+/g, '_')}.pdf`);
  };

  const filteredStudents = students.filter(s => 
    s.displayName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.studentCode && s.studentCode.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Group grades by course
  const gradesByCourse = studentGrades.reduce((acc, g) => {
    const courseName = courses.find(c => c.id === g.courseId)?.name || 'Unknown';
    if (!acc[courseName]) acc[courseName] = [];
    acc[courseName].push(g);
    return acc;
  }, {} as Record<string, Grade[]>);

  // Combine schedule changes and status history for unified chronological logs
  const combinedHistory = [
    ...scheduleChanges.map(sc => {
      const date = sc.createdAt?.toDate ? sc.createdAt.toDate() : (sc.createdAt ? new Date(sc.createdAt) : new Date());
      return {
        id: sc.id,
        timestamp: date,
        type: 'schedule',
        title: 'Cambio de Horario • Nivel',
        details: `Cambio de horario a ${sc.newSchedule} (${sc.newShift || 'N/A'})` + 
                 (sc.oldLevel !== sc.newLevel ? `, nivel cambió de ${sc.oldLevel || 'N/A'} a ${sc.newLevel}` : '') +
                 (sc.paidForChange ? `. Pago realizado: ${sc.paymentAmount} Bs ${sc.receiptNumber ? `(Recibo: ${sc.receiptNumber})` : ''}` : ''),
        author: sc.createdBy || 'Admin'
      };
    }),
    ...statusHistory.map(sh => {
      const date = sh.changedAt?.toDate ? sh.changedAt.toDate() : (sh.changedAt ? new Date(sh.changedAt) : new Date());
      let actionTitle = 'Cambio de Estatus';
      let detailsText = `Estatus cambiado de "${sh.oldStatusId || 'Ninguno'}" a "${sh.newStatusId}"`;

      if (sh.newStatusId === 'frozen') {
        actionTitle = 'Congelamiento de Matrícula ❄️';
        detailsText = `Se congeló el perfil del estudiante. Motivo: ${sh.reason || 'No especificado'}`;
      } else if (sh.reason === 'Reincorporación' && sh.newStatusId === 'active') {
        actionTitle = 'Reincorporación Estudiantil ⚡';
        detailsText = `Se reincorporó formalmente al estudiante al estado Activo.`;
      } else if (sh.newStatusId === 'active' && sh.oldStatusId === 'frozen') {
        actionTitle = 'Reincorporación Estudiantil ⚡';
        detailsText = `Se reactivó al estudiante de un estado de congelamiento previo.`;
      }

      return {
        id: sh.id,
        timestamp: date,
        type: 'status',
        title: actionTitle,
        details: detailsText,
        author: sh.changedBy || 'Admin'
      };
    })
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  return (
    <div className="space-y-8">
      {/* Work Assessment Modal */}
      <WorkAssessmentModal 
        isOpen={isWorkAssessmentOpen}
        onClose={() => setIsWorkAssessmentOpen(false)}
        grade={selectedAssessmentGrade}
        student={selectedStudent}
        enrollment={enrollment}
        teachers={teachers}
        courses={courses}
      />

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Kardex Académico</h2>
          <p className="text-stone-500">Historial de notas y avance académico de los alumnos.</p>
        </div>
        {selectedStudent && (
          <div className="flex items-center gap-3 no-print">
            <button 
              onClick={generatePDF}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-2xl font-bold hover:bg-emerald-700 transition-all shadow-lg"
            >
              <FileDown className="w-5 h-5" />
              Descargar PDF
            </button>
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-bordeaux text-white rounded-2xl font-bold hover:bg-bordeaux-dark transition-all shadow-lg"
            >
              <Printer className="w-5 h-5" />
              Imprimir
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-4 no-print">
          <div className="bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
            <h3 className="text-sm font-bold text-stone-400 uppercase tracking-widest mb-4">Buscar Alumno</h3>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input 
                type="text" 
                placeholder="Nombre o email..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 focus:ring-2 focus:ring-bordeaux outline-none text-sm"
              />
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
              {filteredStudents.map(student => {
                const studentEnrollment = enrollments.find(e => 
                  (student.studentCode && e.studentCode === student.studentCode) || 
                  (student.email && e.studentEmail === student.email)
                );
                const isFrozen = studentEnrollment?.status === 'frozen';
                return (
                  <button
                    key={student.uid}
                    onClick={() => setSelectedStudent(student)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl transition-all border flex items-center gap-3",
                      selectedStudent?.uid === student.uid 
                        ? "bg-bordeaux text-white border-bordeaux shadow-lg shadow-bordeaux/20" 
                        : "bg-white text-stone-600 border-stone-100 hover:border-stone-200 hover:bg-stone-50"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                      selectedStudent?.uid === student.uid ? "bg-white/20" : "bg-stone-100"
                    )}>
                      {student.displayName.charAt(0)}
                    </div>
                    <div className="truncate flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-bold text-sm truncate">{student.displayName}</span>
                        {isFrozen && (
                          <span className="text-xs shrink-0" title={`Congelado: ${studentEnrollment.freezeReason || 'No especificado'}`}>❄️</span>
                        )}
                      </div>
                      <div className={cn(
                        "text-[10px] truncate",
                        selectedStudent?.uid === student.uid ? "text-white/60" : "text-stone-400"
                      )}>{student.email}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6 print-area">
          {selectedStudent ? (
            <>
              {/* Student Header */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b-2 border-dashed border-stone-100">
                  <div className="flex items-center gap-6">
                    <div className="w-20 h-20 shrink-0">
                      <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-3xl font-serif font-black uppercase tracking-tight text-stone-900 italic">Kardex-First Class Institute</h1>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black uppercase tracking-widest text-stone-400 italic">Code:</span>
                       <div className="border-2 border-stone-900 px-6 py-1 font-black text-xl bg-stone-50 min-w-[120px] text-center">
                         {selectedStudent.studentCode || '11054'}
                       </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-sm font-bold uppercase tracking-tight">
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <span className="text-stone-400 italic shrink-0">Last Names:</span>
                    <div className="flex-1 font-black text-stone-800 text-base">{enrollment?.lastName || selectedStudent.displayName.split(' ').slice(-2).join(' ')}</div>
                  </div>
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2">
                    <span className="text-stone-400 italic shrink-0">Name(s):</span>
                    <div className="flex-1 font-black text-stone-800 text-base">{enrollment?.firstName || selectedStudent.displayName.split(' ').slice(0, -2).join(' ')}</div>
                  </div>
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2 md:col-span-1">
                    <span className="text-stone-400 italic shrink-0">Address:</span>
                    <div className="flex-1 font-black text-stone-800 text-base truncate">{enrollment?.address || '---'}</div>
                  </div>
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2 md:col-span-1">
                    <span className="text-stone-400 italic shrink-0">Starting Date:</span>
                    <div className="flex-1 font-black text-stone-800 text-base">{enrollment?.startDate || '---'}</div>
                  </div>
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2 md:col-span-1">
                    <span className="text-stone-400 italic shrink-0">Starting Level:</span>
                    <div className="flex-1 font-black text-stone-800 text-base">{enrollment?.level || '---'}</div>
                  </div>
                  <div className="flex items-center gap-2 border-b border-stone-100 pb-2 md:col-span-1">
                    <span className="text-stone-400 italic shrink-0">Initial Schedule:</span>
                    <div className="flex-1 font-black text-stone-800 text-base">{enrollment?.schedule || enrollment?.shift || '---'}</div>
                  </div>
                </div>

                {enrollment?.status === 'frozen' && (
                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-2 text-blue-800 font-bold uppercase tracking-wider">
                      <span>❄️</span>
                      <span>Estudiante con matrícula congelada</span>
                    </div>
                    {enrollment.freezeReason && (
                      <p className="text-blue-700 italic font-medium ml-6">
                        "Motivo: {enrollment.freezeReason}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Historial de Cambios / Bitácora Administrativa */}
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-stone-100 space-y-6 no-print">
                <div className="flex items-center gap-2.5 pb-4 border-b border-stone-100">
                  <div className="w-10 h-10 bg-bordeaux/10 rounded-full flex items-center justify-center">
                    <History className="w-5 h-5 text-bordeaux" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-stone-900 uppercase tracking-tight">Historial Administrativo</h2>
                    <p className="text-xs text-stone-500">Registro histórico de cambios de horario, estatus, congelamiento y reincorporación del alumno.</p>
                  </div>
                </div>

                <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {combinedHistory.length > 0 ? (
                    combinedHistory.map((log) => (
                      <div key={log.id} className="p-4 rounded-2xl border border-stone-100 bg-stone-50/50 hover:bg-stone-50 transition-colors flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs font-bold uppercase tracking-tight text-stone-800">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shrink-0",
                              log.type === 'schedule' ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"
                            )}>
                              {log.title}
                            </span>
                            <span className="text-[10px] text-stone-400 font-normal">
                              {log.timestamp.toLocaleString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-stone-600 font-medium normal-case tracking-normal">
                            {log.details}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-stone-400 font-normal shrink-0">
                          <span>Realizado por:</span>
                          <span className="font-bold text-stone-600 uppercase tracking-widest">{log.author}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-6 text-center text-stone-500 italic font-medium uppercase text-xs tracking-widest">
                      No hay registros de cambios administrativos para este alumno.
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Detail */}
              <div className="space-y-8">
                {Object.entries(gradesByCourse).length > 0 ? (
                  Object.entries(gradesByCourse).map(([courseName, courseGrades]) => (
                    <div key={courseName} className="space-y-6">
                      {courseGrades.map((g, idx) => {
                         const midtermTotal = g.midtermTotal || 0;
                         const finalTotal = g.finalTotal || 0;
                         const average = Math.round((midtermTotal + finalTotal) / 2);
                         const pass = average >= 70;
                         const teacher = teachers.find(t => t.uid === g.teacherId);

                         return (
                          <motion.div 
                            key={g.id || idx}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-white p-8 rounded-3xl shadow-sm border-2 border-stone-900 space-y-6"
                          >
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                              <div className="flex items-center gap-2 border-b-2 border-dashed border-stone-100 pb-2">
                                <span className="text-[10px] font-black uppercase text-stone-400 italic shrink-0">Level:</span>
                                <div className="border-2 border-stone-900 px-4 py-1 font-black text-lg bg-stone-50 flex-1 text-center">
                                  {g.courseName.split(' ')[1] || g.courseName}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 border-b-2 border-dashed border-stone-100 pb-2">
                                <span className="text-[10px] font-black uppercase text-stone-400 italic shrink-0">Ending date:</span>
                                <div className="border-2 border-stone-900 px-4 py-1 font-black text-lg bg-stone-50 flex-1 text-center">
                                  {g.createdAt?.toDate().toLocaleDateString() || '---'}
                                </div>
                              </div>
                              <div className="flex items-center gap-2 border-b-2 border-dashed border-stone-100 pb-2">
                                <span className="text-[10px] font-black uppercase text-stone-400 italic shrink-0">Facilitator:</span>
                                <div className="border-2 border-stone-900 px-4 py-1 font-black text-lg bg-stone-50 flex-1 truncate text-center">
                                  {teacher?.displayName || '---'}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
                              {[
                                { label: 'Attendance', val: g.finalAttendance },
                                { label: 'Participation', val: g.finalParticipation },
                                { label: 'Oral Eval.', val: g.finalOral },
                                { label: 'Written Eval.', val: g.finalWritten },
                                { label: 'Practices', val: g.finalPractices }
                              ].map((item, i) => (
                                <div key={i} className="flex items-center gap-2">
                                  <span className="text-[9px] font-black uppercase text-stone-400 italic leading-tight">{item.label}:</span>
                                  <div className="border-2 border-stone-900 w-12 h-10 flex items-center justify-center font-black text-lg bg-stone-50 shrink-0">
                                    {item.val}
                                  </div>
                                </div>
                              ))}
                            </div>

                            <div className="flex flex-wrap items-center gap-8 py-4 border-y-2 border-dashed border-stone-100">
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-black uppercase text-stone-400 italic">Total Final:</span>
                                <div className="border-4 border-stone-900 px-10 py-1 font-black text-3xl bg-stone-50">
                                  {g.finalTotal}
                                </div>
                              </div>
                              <div className="flex items-center gap-6">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-black uppercase text-stone-400 italic">Pass:</span>
                                  <div className="w-10 h-10 border-4 border-stone-900 flex items-center justify-center bg-stone-50">
                                    {pass && <CheckSquare className="w-8 h-8 text-stone-900" />}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-black uppercase text-stone-400 italic">Fail:</span>
                                  <div className="w-10 h-10 border-4 border-stone-900 flex items-center justify-center bg-stone-50">
                                    {!pass && <CheckSquare className="w-8 h-8 text-stone-900" />}
                                  </div>
                                </div>
                              </div>

                              <div className="flex-1 flex justify-end gap-3 no-print">
                                <button
                                  onClick={() => {
                                    setSelectedAssessmentGrade(g);
                                    setIsWorkAssessmentOpen(true);
                                  }}
                                  className="px-6 py-2.5 bg-bordeaux text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-opacity-90 transition-all shadow-lg flex items-center gap-2"
                                >
                                  <ClipboardList className="w-4 h-4" />
                                  Work Assessment
                                </button>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <span className="text-[11px] font-black uppercase text-stone-400 italic">Observations:</span>
                              <div className="border-2 border-stone-900 p-4 min-h-[80px] bg-stone-50 font-black italic uppercase text-stone-700">
                                {g.comments || '---'}
                              </div>
                            </div>
                          </motion.div>
                         );
                      })}
                    </div>
                  ))
                ) : (
                  <div className="bg-white rounded-[2rem] border-2 border-dashed border-stone-200 p-12 text-center">
                    <History className="w-12 h-12 text-stone-200 mx-auto mb-4" />
                    <p className="text-stone-500 font-medium">No se encontraron registros académicos para este alumno.</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="bg-white rounded-[2rem] p-20 text-center border border-stone-100 shadow-sm">
              <ClipboardList className="w-20 h-20 text-stone-100 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-stone-900 mb-2">Selecciona un alumno</h3>
              <p className="text-stone-400 max-w-sm mx-auto">Busca y selecciona un alumno del menú lateral para visualizar su kardex académico completo.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KardexManagement;

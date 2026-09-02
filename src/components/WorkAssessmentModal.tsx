import React, { useState, useEffect } from 'react';
import { ClipboardList, Printer, X, CheckSquare, FileDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LOGO_URL } from '../constants';
import { Grade, UserProfile, Enrollment, Course } from '../types';
import { jsPDF } from 'jspdf';

interface WorkAssessmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  grade: Grade | null;
  student: UserProfile | null;
  enrollment: Enrollment | null;
  teachers: UserProfile[];
  courses: Course[];
}

const WorkAssessmentModal = ({ 
  isOpen, 
  onClose, 
  grade, 
  student, 
  enrollment,
  teachers,
  courses
}: WorkAssessmentModalProps) => {
  if (!isOpen || !grade || !student) return null;

  const teacher = teachers.find(t => t.uid === grade.teacherId);

  // Split name if possible
  const nameParts = student.displayName.split(' ');
  const lastName = enrollment?.lastName || (nameParts.length > 2 ? `${nameParts[nameParts.length - 2]} ${nameParts[nameParts.length - 1]}` : nameParts[nameParts.length - 1]);
  const firstName = enrollment?.firstName || (nameParts.length > 2 ? nameParts.slice(0, nameParts.length - 2).join(' ') : nameParts[0]);

  const midtermTotal = grade.midtermTotal;
  const finalTotal = grade.finalTotal;
  const average = Math.round((midtermTotal + finalTotal) / 2);
  const pass = average >= 70;

  const [recommendedLevel, setRecommendedLevel] = useState('EF 1B');
  const [endingDate, setEndingDate] = useState(enrollment?.endDate || 'February 27, 2026');
  const [facilitator, setFacilitator] = useState(teacher?.displayName || 'Estela Quinteros');
  const [schedule, setSchedule] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (grade) {
      const currentTeacher = teachers.find(t => t.uid === grade.teacherId);
      setFacilitator(currentTeacher?.displayName || 'Estela Quinteros');
      
      const course = courses.find(c => c.id === grade.courseId);
      setSchedule(course?.schedule || enrollment?.schedule || enrollment?.shift || '15:00 - 16:15');
      
      setEndingDate(enrollment?.endDate || 'February 27, 2026');
      
      const currentLevelStr = grade.courseName.split(' ')[1] || grade.courseName;
      setRecommendedLevel(currentLevelStr);
    }
  }, [grade, enrollment, teachers, courses]);

  const handleDownloadPDF = async () => {
    setIsGenerating(true);
    try {
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
          img.onerror = () => {
            resolve(null);
          };
          img.src = LOGO_URL;
        });
      };

      const logoBase64 = await loadLogo();

      // 1. Draw outer double frame
      doc.setDrawColor(28, 25, 23); // charcoal
      doc.setLineWidth(0.8);
      doc.rect(8, 8, 194, 281);
      doc.setLineWidth(0.2);
      doc.rect(9.5, 9.5, 191, 278);

      // 2. Header: Logo on left, Title on right
      if (logoBase64) {
        doc.addImage(logoBase64, 'PNG', 15, 15, 24, 24);
      } else {
        // Elegant logo typography path
        doc.setFillColor(115, 12, 32); // deep crimson / bordeaux
        doc.rect(15, 15, 24, 24, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('E', 27, 31, { align: 'center' });
      }

      doc.setTextColor(28, 25, 23);
      doc.setFont('times', 'bolditalic');
      doc.setFontSize(30);
      doc.text('WORK ASSESSMENT', 45, 28);
      
      doc.setDrawColor(115, 12, 32); // deep bordeaux
      doc.setLineWidth(1.5);
      doc.line(45, 31, 195, 31);

      doc.setFont('times', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text('Academic Progression & Skill Evaluation Report', 45, 37);

      // Horizontal separator
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(15, 42, 195, 42);

      // 3. Metadata block
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(28, 25, 23);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('FACILITATOR:', 15, 48);
      doc.setFont('helvetica', 'normal');
      doc.text(facilitator, 46, 48);
      doc.line(45, 49, 115, 49);

      doc.setFont('helvetica', 'bold');
      doc.text('STUDENT CODE:', 15, 55);
      doc.setFont('helvetica', 'bold');
      doc.text(student.studentCode || '11054', 46, 55);
      doc.line(45, 56, 75, 56);

      doc.setFont('helvetica', 'bold');
      doc.text('SCHEDULE:', 85, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(schedule, 108, 55);
      doc.line(107, 56, 145, 56);

      doc.setFont('helvetica', 'bold');
      doc.text('LEVEL:', 152, 48);
      doc.setFont('helvetica', 'bold');
      const levelStr = grade.courseName.split(' ')[1] || grade.courseName;
      doc.text(levelStr, 178, 48);
      doc.line(178, 49, 195, 49);

      doc.setFont('helvetica', 'bold');
      doc.text('ENDING DATE:', 152, 55);
      doc.setFont('helvetica', 'normal');
      doc.text(endingDate, 178, 55);
      doc.line(178, 56, 195, 56);

      doc.setFont('helvetica', 'bold');
      doc.text('LAST NAMES:', 15, 63);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(lastName.toUpperCase(), 46, 63);
      doc.line(45, 64, 195, 64);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('NAME(S):', 15, 71);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(firstName.toUpperCase(), 46, 71);
      doc.line(45, 72, 195, 72);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('RECOMMENDED LEVEL:', 15, 79);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(recommendedLevel, 61, 79);
      doc.line(60, 80, 115, 80);

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('ACADEMIC STATUS:', 125, 79);
      
      // Checkboxes
      doc.rect(165, 75, 5, 5);
      if (pass) {
        doc.setFont('helvetica', 'bold');
        doc.text('X', 167.5, 79, { align: 'center' });
      }
      doc.setFontSize(8);
      doc.text('PASS', 172, 79);

      doc.rect(183, 75, 5, 5);
      if (!pass) {
        doc.setFont('helvetica', 'bold');
        doc.text('X', 185.5, 79, { align: 'center' });
      }
      doc.text('FAIL', 190, 79);

      // Separator
      doc.setDrawColor(115, 12, 32);
      doc.setLineWidth(0.8);
      doc.line(15, 86, 195, 86);

      // 4. Scores Table
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(28, 25, 23);
      doc.text('ACADEMIC SCORES & PERFORMANCE', 15, 93);

      const tableHeaderY = 97;
      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.4);
      doc.setFillColor(242, 242, 240);
      doc.rect(15, tableHeaderY, 180, 8, 'F');
      doc.rect(15, tableHeaderY, 180, 38);

      const colWidths = [30, 25, 25, 25, 25, 25, 25];
      const colLabels = [
        'PERIOD',
        'ATTENDANCE\n10%',
        'PARTICIPATION\n35%',
        'ORAL EVAL.\n20%',
        'WRITTEN EVAL.\n25%',
        'PRACTICES\n10%',
        'TOTAL\nSCORE'
      ];

      let currentX = 15;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);

      for (let i = 0; i < colWidths.length; i++) {
        const centerX = currentX + colWidths[i] / 2;
        const textLines = colLabels[i].split('\n');
        if (textLines.length === 1) {
          doc.text(textLines[0], centerX, tableHeaderY + 5, { align: 'center' });
        } else {
          doc.text(textLines[0], centerX, tableHeaderY + 3.2, { align: 'center' });
          doc.text(textLines[1], centerX, tableHeaderY + 6.3, { align: 'center' });
        }

        if (i > 0) {
          doc.line(currentX, tableHeaderY, currentX, tableHeaderY + 38);
        }
        currentX += colWidths[i];
      }

      doc.line(15, tableHeaderY + 8, 195, tableHeaderY + 8);
      doc.line(15, tableHeaderY + 18, 195, tableHeaderY + 18);
      doc.line(15, tableHeaderY + 28, 195, tableHeaderY + 28);

      doc.setFillColor(232, 232, 228);
      doc.rect(15, tableHeaderY + 28, 180, 10, 'F');

      currentX = 15;
      for (let i = 0; i < colWidths.length; i++) {
        if (i > 0) {
          doc.line(currentX, tableHeaderY, currentX, tableHeaderY + 38);
        }
        currentX += colWidths[i];
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      
      const midtermY = tableHeaderY + 14;
      doc.setFont('helvetica', 'bold');
      doc.text('MIDTERM', 30, midtermY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(String(grade.midtermAttendance), 52.5, midtermY, { align: 'center' });
      doc.text(String(grade.midtermParticipation), 77.5, midtermY, { align: 'center' });
      doc.text(String(grade.midtermOral), 102.5, midtermY, { align: 'center' });
      doc.text(String(grade.midtermWritten), 127.5, midtermY, { align: 'center' });
      doc.text(String(grade.midtermPractices), 152.5, midtermY, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(String(grade.midtermTotal), 182.5, midtermY, { align: 'center' });

      const finalY = tableHeaderY + 24;
      doc.text('FINAL', 30, finalY, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.text(String(grade.finalAttendance), 52.5, finalY, { align: 'center' });
      doc.text(String(grade.finalParticipation), 77.5, finalY, { align: 'center' });
      doc.text(String(grade.finalOral), 102.5, finalY, { align: 'center' });
      doc.text(String(grade.finalWritten), 127.5, finalY, { align: 'center' });
      doc.text(String(grade.finalPractices), 152.5, finalY, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(String(grade.finalTotal), 182.5, finalY, { align: 'center' });

      const avgY = tableHeaderY + 34;
      doc.text('AVERAGE', 30, avgY, { align: 'center' });
      doc.setFont('helvetica', 'bold');
      doc.text(String(Math.round((grade.midtermAttendance + grade.finalAttendance) / 2)), 52.5, avgY, { align: 'center' });
      doc.text(String(Math.round((grade.midtermParticipation + grade.finalParticipation) / 2)), 77.5, avgY, { align: 'center' });
      doc.text(String(Math.round((grade.midtermOral + grade.finalOral) / 2)), 102.5, avgY, { align: 'center' });
      doc.text(String(Math.round((grade.midtermWritten + grade.finalWritten) / 2)), 127.5, avgY, { align: 'center' });
      doc.text(String(Math.round((grade.midtermPractices + grade.finalPractices) / 2)), 152.5, avgY, { align: 'center' });
      doc.setFontSize(11);
      doc.text(String(average), 182.5, avgY, { align: 'center' });

      // 5. Comments Section block
      doc.setTextColor(28, 25, 23);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('TRACKING COMMENTS & FEEDBACK', 15, 148);

      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.setLineDashPattern([1.5, 1.5], 0);
      doc.rect(15, 153, 180, 52);
      doc.setLineDashPattern([], 0);

      doc.setFont('times', 'italic');
      doc.setFontSize(10.5);
      doc.setTextColor(60, 60, 60);
      const commentLines = doc.splitTextToSize(grade.comments || 'No feedback records provided for this learning term.', 170);
      doc.text(commentLines, 20, 161);

      // 6. Signature line
      doc.setDrawColor(120, 120, 120);
      doc.setLineWidth(0.4);
      
      const sigY = 240;
      doc.line(25, sigY, 90, sigY);
      doc.line(120, sigY, 185, sigY);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(100, 100, 100);
      doc.text('FACILITATOR SIGNATURE', 57.5, sigY + 5, { align: 'center' });
      doc.text('ACADEMIC DIRECTION SIGNATURE', 152.5, sigY + 5, { align: 'center' });

      // Footnote footer
      doc.setFontSize(8);
      doc.text(`Generated on ${new Date().toLocaleDateString('es-ES')} - Work Assessment Certification Report`, 15, 268);

      const filename = `Work_Assessment_${lastName.replace(/\s+/g, '_')}_${firstName.replace(/\s+/g, '_')}.pdf`;
      doc.save(filename);
    } catch (err) {
      console.error('Error generating assessment PDF:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (enrollment?.endDate) setEndingDate(enrollment.endDate);
    if (teacher?.displayName) setFacilitator(teacher.displayName);
  }, [enrollment, teacher]);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm no-print">
        <motion.div
           initial={{ opacity: 0, scale: 0.9, y: 20 }}
           animate={{ opacity: 1, scale: 1, y: 0 }}
           exit={{ opacity: 0, scale: 0.9, y: 20 }}
           className="bg-white w-full max-w-5xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
        >
          {/* Modal Header */}
          <div className="px-8 py-6 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
            <h3 className="text-xl font-bold text-stone-900 flex items-center gap-2">
              <ClipboardList className="w-6 h-6 text-emerald-600" />
              Vista Previa: Work Assessment
            </h3>
            <div className="flex items-center gap-3">
              <button 
                onClick={handleDownloadPDF}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700 transition-all active:scale-95 shadow-sm disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full" />
                    Generando...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" />
                    Descargar PDF
                  </>
                )}
              </button>
              <button 
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-stone-900 text-white rounded-xl text-sm font-bold hover:bg-stone-800 transition-all active:scale-95 shadow-sm"
              >
                <Printer className="w-4 h-4" />
                Imprimir
              </button>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-stone-200 rounded-full transition-colors text-stone-400 hover:text-stone-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Modal Content / The Form */}
          <div className="flex-1 overflow-y-auto p-8 md:p-12 bg-stone-50/30">
            <div className="bg-white p-8 border border-stone-200 shadow-sm mx-auto max-w-[900px] font-sans text-stone-900">
              {/* Branding and Title */}
              <div className="flex flex-col md:flex-row border-b-2 border-dashed border-stone-200 pb-6 mb-6 gap-6">
                <div className="flex-1 flex items-center gap-4 md:gap-8">
                  <div className="w-16 h-16 md:w-24 md:h-24 shrink-0">
                    <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-2xl md:text-4xl font-serif font-black uppercase tracking-tight text-stone-900 italic">Work Assessment</h1>
                </div>
                <div className="w-full md:w-[300px] space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-bold whitespace-nowrap">Facilitator:</span>
                    <input 
                      type="text"
                      value={facilitator}
                      onChange={(e) => setFacilitator(e.target.value)}
                      className="border-b border-black flex-1 px-2 font-medium outline-none bg-transparent min-w-0" 
                    />
                  </div>
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-4">
                    <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                      <span className="font-bold whitespace-nowrap">Code:</span>
                      <div className="border border-black px-4 py-1 font-bold bg-stone-50 flex-1 text-center">{student.studentCode || '11054'}</div>
                    </div>
                    <div className="flex items-center gap-2 flex-[1.5] min-w-[150px]">
                      <span className="font-bold whitespace-nowrap">Schedule:</span>
                      <input 
                        type="text"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                        className="border border-black px-4 py-1 font-bold bg-stone-50 outline-none w-full text-center" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Names row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8 mb-6 text-sm">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <span className="font-bold text-lg whitespace-nowrap italic">Last Names:</span>
                  <div className="border border-black px-4 py-2 flex-1 font-bold text-lg uppercase bg-stone-50">{lastName}</div>
                </div>
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
                  <span className="font-bold text-lg whitespace-nowrap italic">Name(s):</span>
                  <div className="border border-black px-4 py-2 flex-1 font-bold text-lg uppercase bg-stone-50">{firstName}</div>
                </div>
              </div>

              {/* Level and Status row */}
              <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 mb-8 text-sm items-center">
                <div className="w-full lg:col-span-3 flex items-center gap-2">
                  <span className="font-bold text-lg italic whitespace-nowrap">Level:</span>
                  <div className="border border-black px-4 py-2 flex-1 font-bold text-lg text-center bg-stone-50">{grade.courseName.split(' ')[1] || grade.courseName}</div>
                </div>
                <div className="w-full lg:col-span-4 flex items-center gap-2">
                  <span className="font-bold text-lg italic whitespace-nowrap">Ending Date:</span>
                  <input 
                    type="text"
                    value={endingDate}
                    onChange={(e) => setEndingDate(e.target.value)}
                    className="border border-black px-4 py-2 flex-1 font-bold text-lg text-center bg-stone-50 outline-none" 
                  />
                </div>
                <div className="w-full lg:col-span-2 flex items-center justify-center gap-6 lg:gap-4 border lg:border-0 border-stone-100 p-4 lg:p-0 rounded-2xl">
                  <div className="flex items-center gap-2">
                    <span className="font-bold italic">Pass:</span>
                    <div className="w-8 h-8 border-2 border-black flex items-center justify-center bg-white">
                      {pass && <CheckSquare className="w-6 h-6" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold italic">Fail:</span>
                    <div className="w-8 h-8 border-2 border-black flex items-center justify-center bg-white">
                      {!pass && <CheckSquare className="w-6 h-6" />}
                    </div>
                  </div>
                </div>
                <div className="w-full lg:col-span-3 flex items-center gap-2">
                  <span className="font-bold italic whitespace-nowrap">Recommended level:</span>
                  <input 
                    type="text"
                    value={recommendedLevel}
                    onChange={(e) => setRecommendedLevel(e.target.value)}
                    className="border border-black px-4 py-2 flex-1 font-bold text-lg text-center bg-stone-50 outline-none" 
                  />
                </div>
              </div>

              {/* Scores Table */}
              <div className="border-2 border-black mb-8 overflow-x-auto scrollbar-hide">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-stone-50">
                      <th className="border-r border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center w-[15%] leading-tight">Attendance 10%</th>
                      <th className="border-r border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center w-[15%] leading-tight">Participation 35%</th>
                      <th className="border-r border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center w-[15%] leading-tight">Oral Eval. 20%</th>
                      <th className="border-r border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center w-[15%] leading-tight">Written Eval. 25%</th>
                      <th className="border-r border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center w-[15%] leading-tight">Practices 10%</th>
                      <th className="border-r border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center w-[15%] bg-stone-200">Total Score</th>
                      <th className="border-b-2 border-black py-3 px-2 text-sm font-black uppercase text-center italic"></th>
                    </tr>
                  </thead>
                  <tbody className="text-xl font-bold">
                    {/* Midterm Row */}
                    <tr>
                      <td className="border-r border-b border-black py-4 text-center">{grade.midtermAttendance}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.midtermParticipation}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.midtermOral}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.midtermWritten}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.midtermPractices}</td>
                      <td className="border-r border-b border-black py-4 text-center bg-stone-100">{grade.midtermTotal}</td>
                      <td className="border-b border-black py-4 px-4 text-base italic uppercase">Midterm</td>
                    </tr>
                    {/* Final Row */}
                    <tr>
                      <td className="border-r border-b border-black py-4 text-center">{grade.finalAttendance}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.finalParticipation}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.finalOral}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.finalWritten}</td>
                      <td className="border-r border-b border-black py-4 text-center">{grade.finalPractices}</td>
                      <td className="border-r border-b border-black py-4 text-center bg-stone-100">{grade.finalTotal}</td>
                      <td className="border-b border-black py-4 px-4 text-base italic uppercase">Final</td>
                    </tr>
                    {/* Average Row */}
                    <tr className="bg-stone-50/50">
                      <td className="border-r border-black py-4 text-center">{Math.round((grade.midtermAttendance + grade.finalAttendance) / 2)}</td>
                      <td className="border-r border-black py-4 text-center">{Math.round((grade.midtermParticipation + grade.finalParticipation) / 2)}</td>
                      <td className="border-r border-black py-4 text-center">{Math.round((grade.midtermOral + grade.finalOral) / 2)}</td>
                      <td className="border-r border-black py-4 text-center">{Math.round((grade.midtermWritten + grade.finalWritten) / 2)}</td>
                      <td className="border-r border-black py-4 text-center">{Math.round((grade.midtermPractices + grade.finalPractices) / 2)}</td>
                      <td className="border-r border-black py-4 text-center bg-stone-200 text-2xl">{average}</td>
                      <td className="py-4 px-4 text-base italic uppercase">Average</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Comments Section */}
              <div className="border-2 border-black border-dashed p-4 md:p-6 min-h-[120px] md:min-h-[150px]">
                <h4 className="text-lg md:text-xl font-black uppercase mb-3 md:mb-4 italic">Comments:</h4>
                <p className="text-lg md:text-xl font-bold uppercase tracking-wide leading-relaxed italic">
                  {grade.comments || 'No comments provided.'}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Print-only layout (simplified and optimized for A4) */}
      <div className="hidden print:block fixed inset-0 bg-white z-[100] p-0 m-0">
        <div className="w-full max-w-[21cm] mx-auto p-8 font-sans text-stone-900 border-2 border-black h-fit">
              {/* Branding and Title */}
              <div className="flex border-b-2 border-dashed border-stone-200 pb-4 mb-4">
                <div className="flex-1 flex items-center gap-6">
                  <div className="w-20 h-20 shrink-0">
                    <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
                  </div>
                  <h1 className="text-3xl font-serif font-black uppercase tracking-tight text-stone-900 italic">Work Assessment</h1>
                </div>
                <div className="w-[250px] space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold whitespace-nowrap">Facilitator:</span>
                    <div className="border-b border-black flex-1 px-1 font-medium">{facilitator}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1 flex-1">
                      <span className="font-bold whitespace-nowrap">Code:</span>
                      <div className="border border-black px-2 py-0.5 font-bold">{student.studentCode || '11054'}</div>
                    </div>
                    <div className="flex items-center gap-1 flex-[1.5]">
                      <span className="font-bold whitespace-nowrap">Schedule:</span>
                      <div className="border border-black px-2 py-0.5 font-bold">{schedule}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Names row */}
              <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base whitespace-nowrap italic">Last Names:</span>
                  <div className="border border-black px-2 py-1 flex-1 font-bold text-base uppercase">{lastName}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base whitespace-nowrap italic">Name(s):</span>
                  <div className="border border-black px-2 py-1 flex-1 font-bold text-base uppercase">{firstName}</div>
                </div>
              </div>

              {/* Level and Status row */}
              <div className="grid grid-cols-12 gap-2 mb-6 text-xs items-center">
                <div className="col-span-3 flex items-center gap-1">
                  <span className="font-bold text-base italic whitespace-nowrap">Level:</span>
                  <div className="border border-black px-2 py-1 flex-1 font-bold text-base text-center">{grade.courseName.split(' ')[1] || grade.courseName}</div>
                </div>
                <div className="col-span-4 flex items-center gap-1">
                  <span className="font-bold text-base italic whitespace-nowrap">Ending Date:</span>
                  <div className="border border-black px-2 py-1 flex-1 font-bold text-base text-center">{endingDate || '---'}</div>
                </div>
                <div className="col-span-2 flex items-center justify-center gap-2">
                  <div className="flex items-center gap-1">
                    <span className="font-bold italic">Pass:</span>
                    <div className="w-6 h-6 border-2 border-black flex items-center justify-center">
                      {pass && <CheckSquare className="w-4 h-4" />}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold italic">Fail:</span>
                    <div className="w-6 h-6 border-2 border-black flex items-center justify-center">
                      {!pass && <CheckSquare className="w-4 h-4" />}
                    </div>
                  </div>
                </div>
                <div className="col-span-3 flex items-center gap-1">
                  <span className="font-bold italic text-[10px] whitespace-nowrap">Recommended:</span>
                  <div className="border border-black px-2 py-1 flex-1 font-bold text-sm text-center">{recommendedLevel}</div>
                </div>
              </div>

              {/* Scores Table */}
              <div className="border-[1.5px] border-black mb-6 overflow-hidden">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-stone-50">
                      <th className="border-r border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center w-[15%] leading-tight">Attendance 10%</th>
                      <th className="border-r border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center w-[15%] leading-tight">Participation 35%</th>
                      <th className="border-r border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center w-[15%] leading-tight">Oral Eval. 20%</th>
                      <th className="border-r border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center w-[15%] leading-tight">Written Eval. 25%</th>
                      <th className="border-r border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center w-[15%] leading-tight">Practices 10%</th>
                      <th className="border-r border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center w-[15%] bg-stone-200">Total Score</th>
                      <th className="border-b border-black py-2 px-1 text-[9px] font-black uppercase text-center italic"></th>
                    </tr>
                  </thead>
                  <tbody className="text-base font-bold">
                    <tr>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.midtermAttendance}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.midtermParticipation}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.midtermOral}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.midtermWritten}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.midtermPractices}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm bg-stone-50">{grade.midtermTotal}</td>
                      <td className="border-b border-black py-2 px-2 text-xs italic uppercase">Midterm</td>
                    </tr>
                    <tr>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.finalAttendance}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.finalParticipation}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.finalOral}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.finalWritten}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm">{grade.finalPractices}</td>
                      <td className="border-r border-b border-black py-2 text-center text-sm bg-stone-50">{grade.finalTotal}</td>
                      <td className="border-b border-black py-2 px-2 text-xs italic uppercase">Final</td>
                    </tr>
                    <tr className="bg-stone-50/50">
                      <td className="border-r border-black py-2 text-center text-sm">{Math.round((grade.midtermAttendance + grade.finalAttendance) / 2)}</td>
                      <td className="border-r border-black py-2 text-center text-sm">{Math.round((grade.midtermParticipation + grade.finalParticipation) / 2)}</td>
                      <td className="border-r border-black py-2 text-center text-sm">{Math.round((grade.midtermOral + grade.finalOral) / 2)}</td>
                      <td className="border-r border-black py-2 text-center text-sm">{Math.round((grade.midtermWritten + grade.finalWritten) / 2)}</td>
                      <td className="border-r border-black py-2 text-center text-sm">{Math.round((grade.midtermPractices + grade.finalPractices) / 2)}</td>
                      <td className="border-r border-black py-2 text-center bg-stone-200 text-lg">{average}</td>
                      <td className="py-2 px-2 text-xs italic uppercase">Average</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Comments Section */}
              <div className="border-[1.5px] border-black border-dashed p-4 min-h-[100px]">
                <h4 className="text-lg font-black uppercase mb-1 italic">Comments:</h4>
                <p className="text-base font-bold uppercase tracking-wide leading-tight italic">
                  {grade.comments || 'No comments provided.'}
                </p>
              </div>
        </div>
      </div>
    </AnimatePresence>
  );
};

export default WorkAssessmentModal;

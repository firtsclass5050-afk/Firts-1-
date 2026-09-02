import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './AuthContext';
import { Toaster } from 'react-hot-toast';
import { motion } from 'motion/react';

// Import extracted components
import { Lobby } from './components/Lobby';
import { RoleSelection } from './components/RoleSelection';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './components/ErrorBoundary';

import FreezeManagement from './components/FreezeManagement';
import ReinstatementManagement from './components/ReinstatementManagement';
import ScheduleChangeManagement from './components/ScheduleChangeManagement';
import DateManagement from './components/DateManagement';
import KardexManagement from './components/KardexManagement';
import StudentsList from './components/StudentsList';
import AdminAttendanceRecords from './components/AdminAttendanceRecords';
import { ClassReportsManagement } from './components/ClassReportsManagement';
import { TeacherReplacementManagement } from './components/ReplacementManagement';
import { BookSalesManagement } from './components/BookSalesManagement';
import { CoursesManagement as Courses } from './components/CoursesManagement';
import { UsersManagement } from './components/UsersManagement';
import { PaymentsManagement } from './components/PaymentsManagement';
import { TeachersManagement } from './components/TeachersManagement';
import { AnnouncementsManagement as Announcements } from './components/AnnouncementsManagement';
import { EnrollmentForm } from './components/EnrollmentForm';
import { StatusManagement } from './components/StatusManagement';
import { UserManual } from './components/UserManual';

import { TeacherAttendance } from './components/AttendanceManagement';
import { TeacherGrades } from './components/TeacherGrades';
import { TeacherReports } from './components/ClassReportsManagement';
import { TeacherReplacementSection } from './components/ReplacementManagement';
import { TeacherProfile } from './components/TeacherProfile';

const AppContent = () => {
  const { user, profile, loading, viewMode } = useAuth();

  const userRole = profile?.role;
  const isMaster = userRole === 'master';
  const isOfficialAdmin = userRole === 'admin' || isMaster;
  const isDirAcad = userRole === 'dir_acad' || isMaster;
  const isAccounting = userRole === 'accounting' || isMaster;
  const isSecretary = userRole === 'secretary' || isMaster;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
          className="w-12 h-12 border-4 border-bordeaux border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (profile?.role === 'pending') {
    return <Lobby />;
  }

  if (viewMode === null) {
    return <RoleSelection />;
  }

  return (
    <>
      <Toaster position="top-right" />
      <Router>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            
            {/* Admin Routes */}
            {viewMode === 'admin' && (
              <>
                {(isSecretary || isOfficialAdmin) && <Route path="/enrollment" element={<EnrollmentForm />} />}
                {(isAccounting || isOfficialAdmin) && <Route path="/payments" element={<PaymentsManagement />} />}
                {(isDirAcad || isOfficialAdmin) && <Route path="/courses" element={<Courses />} />}
                {(isDirAcad || isAccounting || isSecretary || isOfficialAdmin) && <Route path="/students" element={<StudentsList />} />}
                {(isDirAcad || isSecretary || isOfficialAdmin) && <Route path="/teachers" element={<TeachersManagement />} />}
                {isOfficialAdmin && <Route path="/users" element={<UsersManagement />} />}
                {(isDirAcad || isOfficialAdmin) && <Route path="/class-reports" element={<ClassReportsManagement />} />}
                {(isDirAcad || isOfficialAdmin) && <Route path="/teacher-replacements" element={<TeacherReplacementManagement />} />}
                {(isDirAcad || isAccounting || isSecretary || isOfficialAdmin) && <Route path="/attendance-records" element={<AdminAttendanceRecords />} />}
                {(isDirAcad || isOfficialAdmin) && <Route path="/kardex" element={<KardexManagement />} />}
                {isOfficialAdmin && <Route path="/freeze" element={<FreezeManagement />} />}
                {(isAccounting || isOfficialAdmin) && <Route path="/reinstatement" element={<ReinstatementManagement />} />}
                {(isDirAcad || isAccounting || isOfficialAdmin) && <Route path="/schedule-change" element={<ScheduleChangeManagement />} />}
                {isOfficialAdmin && <Route path="/book-sales" element={<BookSalesManagement />} />}
                {(isAccounting || isOfficialAdmin) && <Route path="/dates" element={<DateManagement />} />}
                {(isAccounting || isOfficialAdmin) && <Route path="/status-management" element={<StatusManagement />} />}
              </>
            )}
            
            {/* Teacher Routes */}
            {viewMode === 'teacher' && (
              <>
                <Route path="/teacher/attendance" element={<TeacherAttendance />} />
                <Route path="/teacher/grades" element={<TeacherGrades />} />
                <Route path="/teacher/reports/weekday" element={<TeacherReports type="weekday" />} />
                <Route path="/teacher/reports/saturday" element={<TeacherReports type="saturday" />} />
                <Route path="/teacher/reports/custom" element={<TeacherReports type="custom" />} />
                <Route path="/teacher/replacements" element={<TeacherReplacementSection />} />
                <Route path="/teacher/profile" element={<TeacherProfile />} />
              </>
            )}

            <Route path="/manual" element={<UserManual />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Layout>
      </Router>
    </>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <ErrorBoundary>
        <AppContent />
      </ErrorBoundary>
    </AuthProvider>
  );
}

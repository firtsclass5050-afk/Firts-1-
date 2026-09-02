import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  LogOut, 
  X, 
  Menu,
  CheckCircle, 
  CheckSquare,
  GraduationCap, 
  Clock,
  User as UserIcon,
  ChevronRight,
  ShieldCheck,
  Briefcase,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  Settings,
  BookMarked,
  CreditCard,
  Snowflake,
  Calendar,
  FileText,
  UserCheck,
  History,
  BarChart3
} from 'lucide-react';
import { LOGO_URL } from '../constants';
import { cn } from '../utils/cn';

export const Layout = ({ children }: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDireccionOpen, setIsDireccionOpen] = useState(true);
  const [isAcademicaOpen, setIsAcademicaOpen] = useState(true);
  const [isAdministrativaOpen, setIsAdministrativaOpen] = useState(true);
  const { profile, logout, viewMode, setViewMode } = useAuth();
  const location = useLocation();

  const toggle = () => setIsOpen(!isOpen);

  const isAdmin = viewMode === 'admin';
  const isTeacher = viewMode === 'teacher';

  const userRole = profile?.role;
  const isMaster = userRole === 'master';
  const isOfficialAdmin = userRole === 'admin' || isMaster;
  const isDirAcad = userRole === 'dir_acad' || isMaster;
  const isAccounting = userRole === 'accounting' || isMaster;
  const isSecretary = userRole === 'secretary' || isMaster;

  const NavLink = ({ to, icon: Icon, children, badge }: any) => (
    <Link 
      to={to} 
      onClick={() => setIsOpen(false)}
      className={cn(
        "flex items-center justify-between px-4 py-2 rounded-lg transition-colors text-sm",
        location.pathname === to 
          ? "bg-orange-primary text-white shadow-md" 
          : "hover:bg-white/10 text-white/80 hover:text-white"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-4 h-4 shrink-0" />
        <span className="font-bold">{children}</span>
      </div>
      {badge > 0 && (
        <span className={cn(
          "text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
          location.pathname === to ? "bg-white text-orange-primary" : "bg-orange-primary text-white"
        )}>
          {badge}
        </span>
      )}
    </Link>
  );

  return (
    <>
      <div 
        className={cn(
          "fixed inset-0 bg-black/50 z-[80] lg:hidden transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={toggle}
      />
      <aside className={cn(
        "fixed top-0 left-0 bottom-0 w-64 bg-bordeaux text-white z-[90] transform transition-transform duration-300 flex flex-col shadow-2xl xl:shadow-none",
        isOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="p-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-16 h-16 flex items-center justify-center overflow-hidden">
              <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">First Classe</h1>
          </div>
          <button onClick={toggle} className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
          {/* User Profile Summary */}
          <div className="px-2 mb-6">
            <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10">
              <div className="w-10 h-10 rounded-full bg-orange-primary flex items-center justify-center font-bold text-white">
                {profile?.displayName?.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate">{profile?.displayName}</p>
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-bold">
                  {viewMode === 'admin' ? 'Dirección' : 'Profesor'}
                </p>
              </div>
            </div>
            {profile?.role === 'master' && (
              <button 
                onClick={() => setViewMode(null)}
                className="w-full mt-2 flex items-center justify-center gap-3 p-2 rounded-xl bg-white/10 hover:bg-white/20 transition-all border border-white/10 group"
              >
                <div className="w-8 h-8 flex items-center justify-center overflow-hidden shrink-0">
                  <img src={LOGO_URL} alt="Logo" className="w-full h-full object-contain brightness-0 invert opacity-70 group-hover:opacity-100 transition-opacity" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest">Cambiar Panel</span>
              </button>
            )}
          </div>

          <NavLink to="/" icon={LayoutDashboard}>Inicio</NavLink>

          {isTeacher && (
            <div className="space-y-1">
              <div className="px-4 py-2 text-white/40 text-[10px] font-bold uppercase tracking-widest">
                Panel de Profesor
              </div>
              <NavLink to="/teacher/attendance" icon={CheckCircle}>Listas</NavLink>
              <NavLink to="/teacher/grades" icon={ClipboardList}>Calificaciones</NavLink>
              <NavLink to="/teacher/reports/custom" icon={Clock}>Clases personalizadas</NavLink>
              <NavLink to="/teacher/reports/weekday" icon={Clock}>Class Report (L-V)</NavLink>
              <NavLink to="/teacher/reports/saturday" icon={Clock}>Reporte Sábados</NavLink>
              <NavLink to="/teacher/replacements" icon={Users}>Reemplazo</NavLink>
              <NavLink to="/teacher/profile" icon={UserIcon}>Mi Perfil</NavLink>
              <NavLink to="/manual" icon={BookMarked}>Manual de Usuario</NavLink>
            </div>
          )}

          {isAdmin && (
            <div className="space-y-1">
              <button 
                onClick={() => setIsDireccionOpen(!isDireccionOpen)}
                className="w-full flex items-center justify-between px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-bold"
              >
                <div className="flex items-center gap-3">
                  <Settings className="w-4 h-4" />
                  <span>Dirección</span>
                </div>
                {isDireccionOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              <AnimatePresence>
                {isDireccionOpen && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pl-4 space-y-1 overflow-hidden"
                  >
                    <div className="space-y-1">
                      <button 
                        onClick={() => setIsAcademicaOpen(!isAcademicaOpen)}
                        className="w-full flex items-center justify-between px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
                      >
                        <span>Funciones Académicas</span>
                        {isAcademicaOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <AnimatePresence>
                        {isAcademicaOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-1 overflow-hidden"
                          >
                            {(isDirAcad || isOfficialAdmin) && <NavLink to="/courses" icon={BookOpen}>Cursos</NavLink>}
                            {(isDirAcad || isAccounting || isSecretary || isOfficialAdmin) && <NavLink to="/students" icon={GraduationCap}>Alumnos</NavLink>}
                            {(isDirAcad || isSecretary || isOfficialAdmin) && <NavLink to="/teachers" icon={Briefcase}>SCHEDULE BOARD</NavLink>}
                            {(isDirAcad || isOfficialAdmin) && <NavLink to="/class-reports" icon={FileText}>Class Reports</NavLink>}
                            {(isDirAcad || isOfficialAdmin) && <NavLink to="/teacher-replacements" icon={Users}>Reemplazo de Profesores</NavLink>}
                            {(isDirAcad || isAccounting || isSecretary || isOfficialAdmin) && <NavLink to="/attendance-records" icon={CheckSquare}>Registro de Listas</NavLink>}
                            {(isDirAcad || isOfficialAdmin) && <NavLink to="/kardex" icon={History}>Kardex</NavLink>}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    <div className="space-y-1">
                      <button 
                        onClick={() => setIsAdministrativaOpen(!isAdministrativaOpen)}
                        className="w-full flex items-center justify-between px-4 py-2 text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors text-xs font-bold uppercase tracking-wider"
                      >
                        <span>Funciones Administrativas</span>
                        {isAdministrativaOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      </button>
                      <AnimatePresence>
                        {isAdministrativaOpen && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="space-y-1 overflow-hidden"
                          >
                            {(isSecretary || isOfficialAdmin) && <NavLink to="/enrollment" icon={ClipboardList}>Inscripción</NavLink>}
                            {(isAccounting || isOfficialAdmin) && <NavLink to="/payments" icon={CreditCard}>Pagos</NavLink>}
                            {(isOfficialAdmin) && <NavLink to="/freeze" icon={Snowflake}>Congelamiento</NavLink>}
                            {(isAccounting || isOfficialAdmin) && <NavLink to="/reinstatement" icon={CheckCircle}>Reincorporación</NavLink>}
                            {(isDirAcad || isAccounting || isOfficialAdmin) && <NavLink to="/schedule-change" icon={Clock}>Cambio de Horario</NavLink>}
                            {(isOfficialAdmin) && <NavLink to="/book-sales" icon={BookMarked}>Venta de Libros</NavLink>}
                            {(isAccounting || isOfficialAdmin) && <NavLink to="/dates" icon={Calendar}>Cambio de Fechas</NavLink>}
                            {(isAccounting || isOfficialAdmin) && <NavLink to="/status-management" icon={ShieldCheck}>Estatus</NavLink>}

                            {isOfficialAdmin && <NavLink to="/users" icon={Users}>Usuarios</NavLink>}
                            <NavLink to="/manual" icon={BookMarked}>Manual de Usuario</NavLink>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </nav>

        <div className="p-6 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-orange-primary flex items-center justify-center overflow-hidden border-2 border-white/20">
              {profile?.photoURL ? (
                <img src={profile.photoURL} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                <UserIcon className="w-6 h-6 text-white" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold truncate">{profile?.displayName}</p>
              <p className="text-[10px] text-white/60 uppercase tracking-widest font-bold">{profile?.role}</p>
            </div>
          </div>
          <button 
            onClick={() => logout()}
            className="flex items-center gap-3 w-full px-4 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors text-sm font-medium"
          >
            <LogOut className="w-4 h-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      </aside>
      <main className="lg:pl-64 min-h-screen">
        <header className="lg:hidden bg-bordeaux text-white p-4 flex items-center justify-end sticky top-0 z-[70] shadow-md">
           <button onClick={toggle} className="p-2 hover:bg-white/10 rounded-lg">
             <Menu className="w-6 h-6" />
           </button>
        </header>
        <div className="p-4 md:p-8">
           {children}
        </div>
      </main>
    </>
  );
};

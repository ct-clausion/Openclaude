import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { useAuthStore } from './store/authStore';
import { queryClient } from './lib/queryClient';
import ErrorPage, { AppErrorBoundary } from './pages/ErrorPage';

import AppShell from './components/layout/AppShell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import OperatorLogin from './pages/OperatorLogin';
import Profile from './pages/Profile';

// Student Pages
import StudentDashboard from './pages/student/Dashboard';
import StudentReview from './pages/student/Review';
import StudentReflection from './pages/student/Reflection';
import StudentConsultation from './pages/student/Consultation';
import StudentNextStep from './pages/student/NextStep';
import StudentStudyGroups from './pages/student/StudyGroups';
import StudentGroupChat from './pages/student/GroupChat';
import StudentCourseEnroll from './pages/student/CourseEnroll';
import StudentVideoCall from './pages/student/VideoCall';
import StudentAnnouncements from './pages/student/Announcements';
import StudentAttendance from './pages/student/Attendance';
import StudentPractice from './pages/student/Practice';

// Operator Pages
import OperatorDashboard from './pages/operator/Dashboard';
import CourseManagement from './pages/operator/CourseManagement';
import CourseDetail from './pages/operator/CourseDetail';
import InstructorAnalysis from './pages/operator/InstructorAnalysis';
import InterventionCenter from './pages/operator/InterventionCenter';
import AnnouncementList from './pages/operator/AnnouncementList';
import OperationReports from './pages/operator/OperationReports';
import WhatIfSimulation from './pages/operator/WhatIfSimulation';
import AuditLog from './pages/operator/AuditLog';
import StudentManagement from './pages/operator/StudentManagement';
import InstructorManagement from './pages/operator/InstructorManagement';
import InviteCodeManagement from './pages/operator/InviteCodeManagement';

// Instructor Pages
import InstructorDashboard from './pages/instructor/Dashboard';
import CurriculumUpload from './pages/instructor/CurriculumUpload';
import QuestionBank from './pages/instructor/QuestionBank';
import Students from './pages/instructor/Students';
import StudentDetail from './pages/instructor/StudentDetail';
import InstructorConsultations from './pages/instructor/Consultations';
import Enrollments from './pages/instructor/Enrollments';
import CourseCreate from './pages/instructor/CourseCreate';
import InstructorVideoCall from './pages/instructor/VideoCall';
import InstructorAttendance from './pages/instructor/AttendanceManagement';
import OperatorAttendanceManagement from './pages/operator/AttendanceManagement';
import InstructorAnnouncements from './pages/instructor/Announcements';

function isPublicPath(pathname: string) {
  return pathname === '/'
    || pathname === '/login'
    || pathname === '/register'
    || pathname === '/operator/login';
}

function AuthSessionSync() {
  const navigate = useNavigate();
  const location = useLocation();
  const queryClientInstance = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const syncFromStorage = useAuthStore((state) => state.syncFromStorage);

  useEffect(() => {
    syncFromStorage();
  }, [syncFromStorage]);

  useEffect(() => {
    // Multiple signals can ask us to reconcile at once (pageshow + focus fire together
    // on tab return). Coalesce with a microtask-sized guard so navigate() isn't
    // called several times in the same frame.
    let pending = false;
    const reconcileAuth = () => {
      if (pending) return;
      pending = true;
      queueMicrotask(() => {
        pending = false;
        syncFromStorage();
        const { token: latestToken, user: latestUser } = useAuthStore.getState();
        if (!latestToken || !latestUser) {
          queryClientInstance.clear();
          if (!isPublicPath(window.location.pathname)) {
            navigate('/login', { replace: true });
          }
        }
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        reconcileAuth();
      }
    };

    window.addEventListener('pageshow', reconcileAuth);
    window.addEventListener('focus', reconcileAuth);
    window.addEventListener('popstate', reconcileAuth);
    window.addEventListener('storage', reconcileAuth);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('pageshow', reconcileAuth);
      window.removeEventListener('focus', reconcileAuth);
      window.removeEventListener('popstate', reconcileAuth);
      window.removeEventListener('storage', reconcileAuth);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, queryClientInstance, syncFromStorage]);

  useEffect(() => {
    if (token && user) return;

    queryClientInstance.clear();
    if (!isPublicPath(location.pathname)) {
      navigate('/login', { replace: true });
    }
  }, [location.pathname, navigate, queryClientInstance, token, user]);

  return null;
}

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, token } = useAuthStore();
  const storedToken = localStorage.getItem('token');

  if (!token || !user || !storedToken) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    const rolePath = user.role.toLowerCase();
    return <Navigate to={`/${rolePath}`} replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppErrorBoundary>
      <Toaster
        position="top-center"
        richColors
        closeButton
        toastOptions={{ duration: 4000 }}
      />
      <BrowserRouter>
        <AuthSessionSync />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/operator/login" element={<OperatorLogin />} />

          {/* Student routes */}
          <Route
            path="/student"
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <AppShell role="student" />
              </ProtectedRoute>
            }
          >
            <Route index element={<StudentDashboard />} />
            <Route path="courses" element={<StudentCourseEnroll />} />
            <Route path="review" element={<StudentReview />} />
            <Route path="practice" element={<StudentPractice />} />
            <Route path="reflection" element={<StudentReflection />} />
            <Route path="study-groups" element={<StudentStudyGroups />} />
            <Route path="study-groups/:groupId/chat" element={<StudentGroupChat />} />
            <Route path="consultation" element={<StudentConsultation />} />
            <Route path="consultation/:id" element={<StudentConsultation />} />
            <Route path="consultation/:consultationId/video" element={<StudentVideoCall />} />
            <Route path="next-step" element={<StudentNextStep />} />
            <Route path="attendance" element={<StudentAttendance />} />
            <Route path="announcements" element={<StudentAnnouncements />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Instructor routes */}
          <Route
            path="/instructor"
            element={
              <ProtectedRoute allowedRoles={['INSTRUCTOR']}>
                <AppShell role="instructor" />
              </ProtectedRoute>
            }
          >
            <Route index element={<InstructorDashboard />} />
            <Route path="courses/new" element={<CourseCreate />} />
            <Route path="curriculum" element={<CurriculumUpload />} />
            <Route path="questions" element={<QuestionBank />} />
            <Route path="enrollments" element={<Enrollments />} />
            <Route path="students" element={<Students />} />
            <Route path="students/:studentId" element={<StudentDetail />} />
            <Route path="attendance" element={<InstructorAttendance />} />
            <Route path="consultations" element={<InstructorConsultations />} />
            <Route path="consultation/:id" element={<InstructorConsultations />} />
            <Route path="consultation/:consultationId/video" element={<InstructorVideoCall />} />
            <Route path="announcements" element={<InstructorAnnouncements />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Operator routes */}
          <Route
            path="/operator"
            element={
              <ProtectedRoute allowedRoles={['OPERATOR']}>
                <AppShell role="operator" />
              </ProtectedRoute>
            }
          >
            <Route index element={<OperatorDashboard />} />
            <Route path="courses" element={<CourseManagement />} />
            <Route path="courses/:courseId" element={<CourseDetail />} />
            <Route path="instructors" element={<InstructorAnalysis />} />
            <Route path="intervention" element={<InterventionCenter />} />
            <Route path="attendance" element={<OperatorAttendanceManagement />} />
            <Route path="announcements" element={<AnnouncementList />} />
            <Route path="reports" element={<OperationReports />} />
            <Route path="simulation" element={<WhatIfSimulation />} />
            <Route path="students" element={<StudentManagement />} />
            <Route path="instructor-management" element={<InstructorManagement />} />
            <Route path="invite-codes" element={<InviteCodeManagement />} />
            <Route path="audit" element={<AuditLog />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          {/* Error page */}
          <Route path="/error" element={<ErrorPage />} />

          {/* Catch-all → 404 */}
          <Route path="*" element={<ErrorPage />} />
        </Routes>
      </BrowserRouter>
      </AppErrorBoundary>
    </QueryClientProvider>
  );
}

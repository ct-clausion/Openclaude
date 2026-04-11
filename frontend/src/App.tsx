import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './store/authStore';
import type { ReactNode } from 'react';

import AppShell from './components/layout/AppShell';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';

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

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: 1,
    },
  },
});

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, token } = useAuthStore();

  if (!token || !user) {
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
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

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
            <Route path="reflection" element={<StudentReflection />} />
            <Route path="study-groups" element={<StudentStudyGroups />} />
            <Route path="study-groups/:groupId/chat" element={<StudentGroupChat />} />
            <Route path="consultation" element={<StudentConsultation />} />
            <Route path="consultation/:id" element={<StudentConsultation />} />
            <Route path="consultation/:consultationId/video" element={<StudentVideoCall />} />
            <Route path="next-step" element={<StudentNextStep />} />
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
            <Route path="consultations" element={<InstructorConsultations />} />
            <Route path="consultation/:id" element={<InstructorConsultations />} />
            <Route path="consultation/:consultationId/video" element={<InstructorVideoCall />} />
          </Route>

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

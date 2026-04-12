import { useNavigate, useLocation } from 'react-router-dom';
import SidebarNavItem from './SidebarNavItem';
import UserInfoFooter from './UserInfoFooter';
import { useSidebarStore } from '../../store/sidebarStore';

interface SidebarProps {
  role: 'student' | 'instructor' | 'operator';
}

interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: string | number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const platformNav: NavSection = {
  title: '플랫폼',
  items: [
    { id: 'dashboard', label: '대시보드', icon: '\u{1F3E0}', path: '' },
  ],
};

const studentNav: NavSection[] = [
  platformNav,
  {
    title: '학습',
    items: [
      { id: 'courses', label: '수강 신청', icon: '📋', path: 'courses' },
      { id: 'review', label: '복습 / 성찰', icon: '📝', path: 'review' },
      { id: 'reflection', label: '학습 성찰', icon: '💭', path: 'reflection' },
    ],
  },
  {
    title: '커뮤니티',
    items: [
      { id: 'study-groups', label: '스터디 그룹', icon: '👥', path: 'study-groups' },
    ],
  },
  {
    title: '상담',
    items: [
      { id: 'consultation', label: '상담 이력', icon: '📅', path: 'consultation' },
      { id: 'next-step', label: '다음 단계', icon: '🎯', path: 'next-step' },
    ],
  },
];

const instructorNav: NavSection[] = [
  platformNav,
  {
    title: '교수 관리',
    items: [
      { id: 'courses-new', label: '과정 생성', icon: '➕', path: 'courses/new' },
      { id: 'curriculum', label: '커리큘럼 등록', icon: '📚', path: 'curriculum' },
      { id: 'questions', label: '문제 관리', icon: '❓', path: 'questions' },
      { id: 'enrollments', label: '수강 승인', icon: '✅', path: 'enrollments' },
      { id: 'students', label: '학생 모니터링', icon: '👥', path: 'students' },
    ],
  },
  {
    title: '상담',
    items: [
      { id: 'consultations', label: '1:1 상담', icon: '📅', path: 'consultations' },
    ],
  },
];

const operatorNav: NavSection[] = [
  platformNav,
  {
    title: '인원 관리',
    items: [
      { id: 'students', label: '학생 관리', icon: '🎓', path: 'students' },
      { id: 'at-risk', label: '위험 학생', icon: '⚠️', path: 'students/at-risk' },
      { id: 'instructor-management', label: '강사 관리', icon: '👨‍🏫', path: 'instructor-management' },
    ],
  },
  {
    title: '횡단 분석',
    items: [
      { id: 'instructors', label: '교강사 분석', icon: '📊', path: 'instructors' },
      { id: 'intervention', label: '개입 지시', icon: '🚨', path: 'intervention' },
    ],
  },
  {
    title: '과정 운영',
    items: [
      { id: 'courses', label: '과정 편성', icon: '📋', path: 'courses' },
      { id: 'attendance', label: '출결 관리', icon: '📝', path: 'attendance' },
    ],
  },
  {
    title: '소통',
    items: [
      { id: 'announcements', label: '공지사항', icon: '📢', path: 'announcements' },
    ],
  },
  {
    title: 'AI 운영',
    items: [
      { id: 'reports', label: 'AI 리포트', icon: '📈', path: 'reports' },
      { id: 'simulation', label: 'AI 시뮬레이션', icon: '🔮', path: 'simulation' },
    ],
  },
  {
    title: '시스템',
    items: [
      { id: 'invite-codes', label: '초대 코드 관리', icon: '🔑', path: 'invite-codes' },
      { id: 'audit', label: '감사 로그', icon: '🔍', path: 'audit' },
    ],
  },
];

const navByRole: Record<string, NavSection[]> = {
  student: studentNav,
  instructor: instructorNav,
  operator: operatorNav,
};

export default function Sidebar({ role }: SidebarProps) {
  const { isCollapsed, toggleSidebar } = useSidebarStore();
  const navigate = useNavigate();
  const location = useLocation();
  const sections = navByRole[role] ?? studentNav;
  const rolePrefix = `/${role}`;

  return (
    <aside
      className={`h-screen flex flex-col bg-white border-r border-slate-300 transition-all duration-200 ${
        isCollapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-14 border-b border-slate-100 flex-shrink-0">
        {!isCollapsed && (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
              <span className="text-white text-xs font-bold">CP</span>
            </div>
            <span className="text-sm font-bold text-slate-900 truncate">ClassPulse Twin</span>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            {isCollapsed ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            )}
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
        {sections.map((section) => (
          <div key={section.title}>
            {!isCollapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {section.title}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => (
                isCollapsed ? (
                  (() => {
                    const fullPath = `${rolePrefix}/${item.path}`;
                    const isActive = fullPath.endsWith('/')
                      ? location.pathname === fullPath || location.pathname === fullPath.slice(0, -1)
                      : location.pathname === fullPath || location.pathname.startsWith(fullPath + '/');
                    return (
                      <button
                        key={item.id}
                        onClick={() => navigate(fullPath)}
                        className={`w-full flex items-center justify-center p-2 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20'
                            : 'text-slate-500 hover:bg-slate-100'
                        }`}
                        title={item.label}
                      >
                        <span className="text-base">{item.icon}</span>
                      </button>
                    );
                  })()
                ) : (
                  <SidebarNavItem
                    key={item.id}
                    id={item.id}
                    label={item.label}
                    icon={item.icon}
                    path={`${rolePrefix}/${item.path}`}
                    badge={item.badge}
                  />
                )
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!isCollapsed && <UserInfoFooter />}
    </aside>
  );
}

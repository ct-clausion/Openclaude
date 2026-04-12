// ── User & Profiles ──────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'OPERATOR';
}

export interface StudentProfile {
  id: string;
  userId: string;
  enrolledCourseIds: string[];
  avatarGradient: string;
  bio: string;
}

export interface InstructorProfile {
  id: string;
  userId: string;
  department: string;
  specialization: string;
  managedCourseIds: string[];
}

// ── Course & Curriculum ──────────────────────────────────────

export interface Course {
  id: string;
  title: string;
  description: string;
  schedule?: string;
  classTime?: string;
  status: string;
  approvalStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvalNote?: string;
  maxCapacity?: number;
  createdBy: string;
  createdAt: string;
}

export interface CourseWeek {
  id: string;
  courseId: string;
  weekNo: number;
  title: string;
  summary: string;
}

export interface CurriculumSkill {
  id: string;
  courseId: string;
  name: string;
  description: string;
  difficulty: string;
  prerequisiteIds: number[];
}

// ── Digital Twin ─────────────────────────────────────────────

export interface StudentTwin {
  id: string;
  studentId: string;
  courseId: string;
  masteryScore: number;
  executionScore: number;
  retentionRiskScore: number;
  motivationScore: number;
  consultationNeedScore: number;
  overallRiskScore: number;
  aiInsight: string | null;
  trendDirection: 'IMPROVING' | 'STABLE' | 'DECLINING' | null;
  trendExplanation: string | null;
  dataConflicts: string[] | null;
  updatedAt: string;
}

export interface SkillMasterySnapshot {
  id: string;
  studentId: string;
  courseId: string;
  skillId: string;
  understandingScore: number;
  practiceScore: number;
  confidenceScore: number;
  forgettingRiskScore: number;
  sourceType: string;
  capturedAt: string;
}

// ── Reflection ───────────────────────────────────────────────

export interface Reflection {
  id: string;
  studentId: string;
  courseId: string;
  content: string;
  selfConfidenceScore: number;
  emotionSummary: string;
  createdAt: string;
}

// ── Review Tasks ─────────────────────────────────────────────

export interface ReviewTask {
  id: string;
  studentId: string;
  courseId: string;
  skillId: string;
  title: string;
  reasonSummary: string;
  scheduledFor: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'SKIPPED';
  completedAt: string | null;
}

// ── Questions ────────────────────────────────────────────────

export interface Question {
  id: string;
  courseId: string;
  skillId: string;
  questionType: string;
  difficulty: number;
  content: string;
  answer: string;
  explanation: string;
  generationReason: string;
  approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// ── Consultation ─────────────────────────────────────────────

export interface Consultation {
  id: string;
  studentId: string;
  studentName?: string;
  instructorId: string;
  instructorName?: string;
  courseId: string;
  courseTitle?: string;
  scheduledAt: string;
  status: string;
  notes?: string;
  summaryText: string;
  causeAnalysis?: string;
  actionPlanJson: string;
  briefingJson?: Record<string, unknown>;
  videoRoomName?: string;
  createdAt: string;
  completedAt?: string;
}

export interface ActionPlan {
  title: string;
  dueDate: string;
  linkedSkillId: string;
  priority: string;
  status: string;
}

// ── Recommendation ───────────────────────────────────────────

export interface Recommendation {
  id: string;
  studentId: string;
  courseId: string;
  recommendationType: string;
  title: string;
  reasonSummary: string;
  triggerEvent: string;
  expectedOutcome: string;
  createdAt: string;
}

// ── Chatbot ──────────────────────────────────────────────────

export interface InlineChatCard {
  type: 'review_steps' | 'resource_link' | 'action_confirm';
  data: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  inlineCards?: InlineChatCard[];
}

export interface Conversation {
  id: string;
  studentId: string;
  courseId: string;
  title: string;
  twinContextJson: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  messages?: ChatMessage[];
}

// ── Gamification ─────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earnedAt: string;
}

export interface GamificationState {
  level: number;
  currentXP: number;
  nextLevelXP: number;
  levelTitle: string;
  streakDays: number;
  badges: Badge[];
}

// ── Study Group ──────────────────────────────────────────────

export interface StudyGroupMember {
  id: string;
  studentId?: string;
  name: string;
  studentName?: string;
  avatarGradient: string;
  strength: string;
  strengthSummary?: string;
  complementNote: string;
  matchScore: number;
}

export interface StudyGroup {
  id: string;
  courseId: string;
  name: string;
  description: string;
  maxMembers: number;
  status: string;
  members: StudyGroupMember[];
}

// ── Group Chat ──────────────────────────────────────────────

export interface GroupChatMessage {
  id: number;
  groupId: number;
  senderId: number;
  senderName: string;
  content: string;
  messageType: string;
  createdAt: string;
  fileKey?: string;
  fileName?: string;
  fileSize?: number;
  contentType?: string;
}

// ── Code Analysis ────────────────────────────────────────────

export interface CodeSubmission {
  id: string;
  studentId: string;
  courseId: string;
  skillId: string;
  codeContent: string;
  language: string;
  status: string;
  createdAt: string;
}

export interface CodeFeedback {
  id: string;
  submissionId: string;
  lineNumber: number;
  endLineNumber: number;
  severity: 'ERROR' | 'WARNING' | 'INFO' | 'GOOD';
  message: string;
  suggestion: string;
  twinLinked: boolean;
  twinSkillId: string | null;
}

// ── Notification ─────────────────────────────────────────────

export interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | string | null;
  isRead: boolean;
  createdAt: string;
}

// ── Charts & Analytics ───────────────────────────────────────

export interface RadarChartData {
  understanding: number;
  execution: number;
  completion: number;
  forgettingRisk: number;
  focus: number;
  confidence: number;
}

// ── Async Jobs ───────────────────────────────────────────────

export interface AsyncJob {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  resultPayload: unknown;
  createdAt: string;
}

// ── Auth DTOs ────────────────────────────────────────────────

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: 'STUDENT' | 'INSTRUCTOR' | 'OPERATOR';
  inviteCode?: string;
}

// ── Operator Types ──────────────────────────────────────────

export interface CourseTwinSnapshot {
  id: string;
  courseId: string;
  courseTitle?: string;
  avgMastery: number;
  avgExecution: number;
  avgMotivation: number;
  retentionRiskRatio: number;
  attendanceRate: number;
  completionProjection: number;
  healthScore: number;
  studentCount: number;
  atRiskCount: number;
  snapshotDate: string;
}

export interface AttendanceRecord {
  id: string;
  sessionId: string;
  studentId: string;
  studentName?: string;
  status: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
  checkInTime?: string;
  note?: string;
}

export interface CourseSessionInfo {
  id: string;
  courseId: string;
  sessionDate: string;
  sessionNumber: number;
  title?: string;
  status: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  targetType: 'ALL' | 'COURSE' | 'INSTRUCTOR_ONLY' | 'STUDENT_ONLY';
  targetCourseId?: string;
  isUrgent: boolean;
  authorId: string;
  authorName?: string;
  createdAt: string;
  readCount?: number;
}

export interface InterventionLog {
  id: string;
  studentId: string;
  studentName?: string;
  operatorId: string;
  courseId?: string;
  courseTitle?: string;
  interventionType: string;
  description: string;
  aiSuggested: boolean;
  twinScoreBefore?: Record<string, number>;
  twinScoreAfter?: Record<string, number>;
  outcome?: string;
  status: string;
  createdAt: string;
  completedAt?: string;
}

export interface OperatorAuditLog {
  id: string;
  operatorId: string;
  actionType: string;
  targetType: string;
  targetId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

export interface OperatorDashboardSummary {
  totalCourses: number;
  activeCourses: number;
  totalStudents: number;
  totalInstructors: number;
  atRiskStudents: number;
  pendingConsultations: number;
  todayAttendanceRate: number;
}

export interface WeeklyKPI {
  week: string;
  attendanceRate: number;
  taskCompletionRate: number;
  activeUsers: number;
  consultationCount: number;
}

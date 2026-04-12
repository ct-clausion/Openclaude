export interface RecommendationAction {
  label: string;
  path: string;
}

export function getRecommendationAction(type?: string | null): RecommendationAction {
  switch (type?.toUpperCase()) {
    case 'REVIEW':
      return { label: '복습하기', path: '/student/review' };
    case 'CONSULTATION':
    case 'COURSE':
      return { label: '상담 보기', path: '/student/consultation' };
    case 'PRACTICE':
    case 'CHALLENGE':
      return { label: '실습하기', path: '/student' };
    case 'RESOURCE':
      return { label: '대시보드 열기', path: '/student' };
    default:
      return { label: '열어보기', path: '/student/review' };
  }
}

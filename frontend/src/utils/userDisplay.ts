export const ROLE_LABELS: Record<string, string> = {
  STUDENT: '학생',
  INSTRUCTOR: '강사',
  OPERATOR: '운영자',
};

export function getDisplayInitial(name?: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return '?';
  return trimmed.charAt(0).toUpperCase();
}

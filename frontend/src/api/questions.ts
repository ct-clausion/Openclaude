import { api } from './client';
import type { Question } from '../types';

export const questionsApi = {
  // Backend requires courseId as Long @RequestParam
  getQuestions(courseId: string, params?: {
    skillId?: string;
    approvalStatus?: Question['approvalStatus'];
  }): Promise<Question[]> {
    const query = new URLSearchParams({ courseId });
    if (params?.skillId) query.set('skillId', params.skillId);
    if (params?.approvalStatus) query.set('approvalStatus', params.approvalStatus);
    return api.get<Question[]>(`/api/questions?${query.toString()}`);
  },

  // Backend returns JobIdResponse { jobId: Long }
  generateQuestions(courseId: string, data: {
    skillId?: number;
    difficulty?: string;
    count: number;
  }): Promise<{ jobId: number }> {
    return api.post<{ jobId: number }>(`/api/courses/${courseId}/questions/generate`, data);
  },

  approveQuestion(questionId: string): Promise<Question> {
    return api.put<Question>(`/api/questions/${questionId}/approve`);
  },

  rejectQuestion(questionId: string): Promise<Question> {
    return api.put<Question>(`/api/questions/${questionId}/reject`);
  },

  createQuestion(data: {
    courseId: string;
    skillId?: string;
    questionType: string;
    difficulty: string;
    content: string;
    answer: string;
    explanation: string;
  }): Promise<Question> {
    return api.post<Question>('/api/questions', {
      ...data,
      courseId: Number(data.courseId),
      skillId: data.skillId ? Number(data.skillId) : null,
    });
  },

  updateQuestion(questionId: string, data: {
    questionType?: string;
    difficulty?: string;
    content?: string;
    answer?: string;
    explanation?: string;
  }): Promise<Question> {
    return api.put<Question>(`/api/questions/${questionId}`, data);
  },

  deleteQuestion(questionId: string): Promise<void> {
    return api.delete<void>(`/api/questions/${questionId}`);
  },
};

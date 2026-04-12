# Playwright Bug Report

Date: 2026-04-12

Scope:
- Frontend built with `rtk npm run build`
- Playwright inspection against local SPA fallback server on `http://127.0.0.1:4175`
- Public routes plus student, instructor, operator protected routes using injected auth state

Environment note:
- Backend, Postgres, Redis, RabbitMQ, LiveKit were not running locally.
- Because of that, API-dependent empty states and SSE MIME errors were observed during route smoke tests, but they are not counted below unless the issue is clearly frontend-side and reproducible from the rendered UI/source itself.

## Findings

### 1. Login role selector is cosmetic only
- Severity: High
- Route: `/login`
- Evidence:
  - The screen exposes a `학생` / `강사` role selector.
  - `handleSubmit` ignores the selected role and always trusts the backend response role for navigation.
  - This means the user-visible selector can be toggled without affecting login behavior at all.
- Source:
  - [frontend/src/pages/Login.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Login.tsx:11)
  - [frontend/src/pages/Login.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Login.tsx:15)
  - [frontend/src/pages/Login.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Login.tsx:67)

### 2. Student dashboard header shows a hardcoded avatar initial
- Severity: Medium
- Route: `/student`
- Evidence:
  - Playwright opened the student dashboard with user `김민준`.
  - Sidebar/footer showed the correct user name, but the top header avatar rendered `J`.
  - This is visible mismatch in the first screen of the student dashboard.
- Source:
  - [frontend/src/pages/student/Dashboard.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/student/Dashboard.tsx:65)

### 3. Instructor dashboard header is hardcoded to another instructor
- Severity: Medium
- Route: `/instructor`
- Evidence:
  - Playwright opened the instructor dashboard with user `박지훈(강사)`.
  - Header still rendered `김교수님의 대시보드` and avatar `김`, plus fixed course text `React 심화 과정 · 6주차`.
  - The screen therefore contradicts the authenticated instructor identity shown in the sidebar.
- Source:
  - [frontend/src/pages/instructor/Dashboard.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/instructor/Dashboard.tsx:18)
  - [frontend/src/pages/instructor/Dashboard.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/instructor/Dashboard.tsx:22)

### 4. “다음 단계 추천” CTA routes practice/resource items to the review page
- Severity: Medium
- Route: `/student/next-step`
- Playwright result:
  - `정렬 알고리즘 코딩 연습` 클릭 후 `/student/review` 이동
  - `딕셔너리 활용 문제 풀기` 클릭 후 `/student/review` 이동
  - `시각화 학습 자료 추천` 클릭 후 `/student/review` 이동
  - Only `강사 상담 예약` was routed to `/student/consultation`
- Why this is a bug:
  - Practice/resource recommendations are presented as distinct action types, but the CTA collapses them into the review page.
- Source:
  - [frontend/src/pages/student/NextStep.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/student/NextStep.tsx:247)

### 5. Operator login screen suggests the wrong email domain
- Severity: Medium
- Route: `/operator/login`
- Evidence:
  - The email placeholder shown on screen is `operator@classpulse.kr`.
  - The seeded operator account and operator screens use `operator@clausion.com`.
  - This is likely to mislead test users and operators during login.
- Source:
  - [frontend/src/pages/OperatorLogin.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/OperatorLogin.tsx:79)
  - [backend/src/main/resources/db/migration/V12__operator_role_and_features.sql](/Users/yoonchan/Desktop/clausion/backend/src/main/resources/db/migration/V12__operator_role_and_features.sql:143)

### 6. Login password placeholder contains visible backslashes
- Severity: Low
- Route: `/login`
- Evidence:
  - Playwright snapshot exposed the password placeholder as `\\•\\•\\•\\•\\•\\•\\•\\•`.
  - The source literal includes backslashes before each bullet, so the placeholder text is malformed.
- Source:
  - [frontend/src/pages/Login.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Login.tsx:113)

### 7. Operator role label is not localized in the sidebar footer
- Severity: Low
- Route: `/operator`, `/operator/*`
- Evidence:
  - Student and instructor footers show localized role labels.
  - Operator footer shows raw English `OPERATOR`.
  - This is visible UI inconsistency in the global shell.
- Source:
  - [frontend/src/components/layout/UserInfoFooter.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/components/layout/UserInfoFooter.tsx:14)

### 8. Auth/password forms are missing autocomplete attributes
- Severity: Low
- Routes:
  - `/login`
  - `/register`
  - `/student/profile` and other profile pages
- Evidence:
  - Browser console emitted DOM warnings for missing `current-password` / `new-password` autocomplete hints.
  - This degrades password-manager/autofill behavior and is directly visible during browser inspection.
- Source:
  - [frontend/src/pages/Login.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Login.tsx:91)
  - [frontend/src/pages/Register.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Register.tsx:140)
  - [frontend/src/pages/Profile.tsx](/Users/yoonchan/Desktop/clausion/frontend/src/pages/Profile.tsx:114)

## Route Smoke Summary

Checked routes:
- Public: `/`, `/login`, `/register`, `/operator/login`
- Student: `/student`, `/student/courses`, `/student/review`, `/student/reflection`, `/student/study-groups`, `/student/consultation`, `/student/next-step`, `/student/profile`
- Instructor: `/instructor`, `/instructor/courses/new`, `/instructor/curriculum`, `/instructor/questions`, `/instructor/enrollments`, `/instructor/students`, `/instructor/consultations`, `/instructor/profile`
- Operator: `/operator`, `/operator/courses`, `/operator/instructors`, `/operator/intervention`, `/operator/attendance`, `/operator/announcements`, `/operator/reports`, `/operator/simulation`, `/operator/audit`, `/operator/profile`

No hard runtime React crash was observed during the smoke pass.

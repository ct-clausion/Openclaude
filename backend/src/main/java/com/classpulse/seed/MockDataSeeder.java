package com.classpulse.seed;

import com.classpulse.domain.chatbot.ChatMessage;
import com.classpulse.domain.chatbot.ChatMessageRepository;
import com.classpulse.domain.chatbot.Conversation;
import com.classpulse.domain.chatbot.ConversationRepository;
import com.classpulse.domain.codeanalysis.CodeFeedback;
import com.classpulse.domain.codeanalysis.CodeFeedbackRepository;
import com.classpulse.domain.codeanalysis.CodeSubmission;
import com.classpulse.domain.codeanalysis.CodeSubmissionRepository;
import com.classpulse.domain.consultation.ActionPlan;
import com.classpulse.domain.consultation.ActionPlanRepository;
import com.classpulse.domain.consultation.Consultation;
import com.classpulse.domain.consultation.ConsultationRepository;
import com.classpulse.domain.course.Course;
import com.classpulse.domain.course.CourseEnrollment;
import com.classpulse.domain.course.CourseEnrollmentRepository;
import com.classpulse.domain.course.CourseWeek;
import com.classpulse.domain.course.CurriculumSkill;
import com.classpulse.domain.gamification.*;
import com.classpulse.domain.learning.Reflection;
import com.classpulse.domain.learning.ReflectionRepository;
import com.classpulse.domain.learning.ReviewTask;
import com.classpulse.domain.learning.ReviewTaskRepository;
import com.classpulse.domain.recommendation.Recommendation;
import com.classpulse.domain.recommendation.RecommendationRepository;
import com.classpulse.domain.studygroup.StudyGroup;
import com.classpulse.domain.studygroup.StudyGroupMember;
import com.classpulse.domain.studygroup.StudyGroupRepository;
import com.classpulse.domain.twin.SkillMasterySnapshot;
import com.classpulse.domain.twin.SkillMasterySnapshotRepository;
import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import com.classpulse.domain.user.User;
import com.classpulse.domain.user.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Slf4j
@Component
@RequiredArgsConstructor
public class MockDataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final StudentTwinRepository studentTwinRepository;
    private final SkillMasterySnapshotRepository snapshotRepository;
    private final ReviewTaskRepository reviewTaskRepository;
    private final ReflectionRepository reflectionRepository;
    private final ConsultationRepository consultationRepository;
    private final ActionPlanRepository actionPlanRepository;
    private final RecommendationRepository recommendationRepository;
    private final GamificationRepository gamificationRepository;
    private final BadgeRepository badgeRepository;
    private final StudentBadgeRepository studentBadgeRepository;
    private final XPEventRepository xpEventRepository;
    private final ConversationRepository conversationRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final CodeSubmissionRepository codeSubmissionRepository;
    private final CodeFeedbackRepository codeFeedbackRepository;
    private final StudyGroupRepository studyGroupRepository;
    private final CourseEnrollmentRepository courseEnrollmentRepository;
    private final PasswordEncoder passwordEncoder;
    private final EntityManager em;

    private static final int N = 100;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.findByEmail("student001@classpulse.dev").isPresent()) {
            log.info("[Seed] Already seeded, skipping.");
            return;
        }
        log.info("[Seed] Seeding {} students with rich demo data...", N);

        String pw = passwordEncoder.encode("password123");
        Random rng = new Random(42);

        String[] lns = {"김","이","박","최","정","강","윤","장","임","한","오","서","신","권","황","안","송","류","홍","전"};
        String[] fns = {"민준","서연","지훈","은서","현우","수빈","도현","하은","태양","서진","예준","지우","시우","하윤","주원","지아","현서","채원","준서","유나",
                "도윤","서윤","건우","민서","은우","소율","우진","지민","재현","다은","시현","예린","승현","연우","규민","하린","정우","수아","지환","유진",
                "성민","나윤","찬영","이서","진우","아인","동현","소윤","태민","시은"};

        // ── Users ──────────────────────────────────────────────────────
        User ins1 = userRepository.save(User.builder().email("instructor01@classpulse.dev").passwordHash(pw).name("박지훈(강사)").role(User.Role.INSTRUCTOR).build());
        User ins2 = userRepository.save(User.builder().email("instructor02@classpulse.dev").passwordHash(pw).name("이영수(강사)").role(User.Role.INSTRUCTOR).build());
        User ins3 = userRepository.save(User.builder().email("instructor03@classpulse.dev").passwordHash(pw).name("김하나(강사)").role(User.Role.INSTRUCTOR).build());
        userRepository.save(User.builder().email("operator@classpulse.dev").passwordHash(pw).name("관리자").role(User.Role.OPERATOR).build());
        User[] ins = {ins1, ins2, ins3};

        User[] stu = new User[N];
        for (int i = 0; i < N; i++) {
            stu[i] = userRepository.save(User.builder()
                    .email(String.format("student%03d@classpulse.dev", i + 1))
                    .passwordHash(pw).name(lns[i % lns.length] + fns[i % fns.length]).role(User.Role.STUDENT).build());
        }

        // ── Courses (3) ───────────────────────────────────────────────
        Course c1 = mkCourse("풀스택 웹개발 부트캠프", "HTML/CSS부터 React, Spring Boot까지 16주 완성", ins1, new String[][]{
                {"HTML & CSS 기초","시맨틱 HTML, Flexbox, Grid"},{"JavaScript 핵심","변수, 함수, 비동기"},
                {"React 기초","컴포넌트, Hooks, State"},{"React 심화","Context, 커스텀 훅, 최적화"},
                {"Java & Spring","OOP, Spring Boot 구조"},{"REST API","RESTful 설계, JPA"},
                {"인증 & 보안","JWT, Spring Security"},{"배포 & DevOps","Docker, CI/CD"}});
        Course c2 = mkCourse("데이터 분석 with Python", "Pandas, NumPy, Matplotlib 데이터 분석", ins2, new String[][]{
                {"Python 기초","변수, 함수, 클래스"},{"NumPy & Pandas","배열, DataFrame"},
                {"데이터 시각화","Matplotlib, Seaborn"},{"통계 기초","기술통계, 가설검정"},
                {"머신러닝 입문","회귀, 분류"},{"프로젝트","실전 분석"}});
        Course c3 = mkCourse("UI/UX 디자인 실무", "Figma UI 디자인과 UX 설계", ins3, new String[][]{
                {"디자인 원칙","색상, 타이포, 레이아웃"},{"Figma 기초","컴포넌트, 오토레이아웃"},
                {"와이어프레임","정보 구조, 네비게이션"},{"프로토타이핑","인터랙션, 애니메이션"},
                {"UX 리서치","사용성 테스트, A/B"}});
        Course[] cs = {c1, c2, c3};

        // ── Skills ────────────────────────────────────────────────────
        List<CurriculumSkill> sk1 = mkSkills(c1, new String[][]{
                {"HTML/CSS","시맨틱 마크업과 반응형 레이아웃","EASY"},{"JavaScript 기초","변수, 함수, 스코프, 비동기","EASY"},
                {"React 컴포넌트","Hooks, 상태관리 패턴","MEDIUM"},{"재귀 함수","재귀적 문제 분해","HARD"},
                {"REST API","RESTful 설계 원칙","MEDIUM"},{"Spring Security","JWT 인증/인가","HARD"}});
        List<CurriculumSkill> sk2 = mkSkills(c2, new String[][]{
                {"Python 문법","변수, 함수, 클래스","EASY"},{"Pandas","DataFrame, 그룹핑","MEDIUM"},
                {"데이터 시각화","차트 작성","MEDIUM"},{"통계 분석","확률분포, 가설검정","HARD"},{"머신러닝 기초","Scikit-learn","HARD"}});
        List<CurriculumSkill> sk3 = mkSkills(c3, new String[][]{
                {"색상/타이포","색상 이론, 서체","EASY"},{"Figma 도구","컴포넌트, 변수","MEDIUM"},
                {"와이어프레임","정보 구조 설계","MEDIUM"},{"프로토타이핑","인터랙션 설계","HARD"}});
        em.flush();
        List<List<CurriculumSkill>> allSk = List.of(sk1, sk2, sk3);

        // ── Enrollments ───────────────────────────────────────────────
        for (int i = 0; i < N; i++) {
            if (i < 70) enroll(stu[i], c1);
            if (i >= 30 && i < 90) enroll(stu[i], c2);
            if (i >= 60) enroll(stu[i], c3);
        }

        // ── Twins (all 100) ───────────────────────────────────────────
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            double f = rng.nextDouble();
            double m, e, rr, mo, cn, or2;
            if (f < 0.20) { m=25+rng.nextDouble()*20; e=20+rng.nextDouble()*20; rr=60+rng.nextDouble()*25; mo=25+rng.nextDouble()*20; cn=65+rng.nextDouble()*20; or2=60+rng.nextDouble()*20; }
            else if (f < 0.50) { m=50+rng.nextDouble()*20; e=45+rng.nextDouble()*25; rr=30+rng.nextDouble()*25; mo=50+rng.nextDouble()*20; cn=35+rng.nextDouble()*25; or2=35+rng.nextDouble()*20; }
            else { m=72+rng.nextDouble()*25; e=70+rng.nextDouble()*25; rr=5+rng.nextDouble()*20; mo=75+rng.nextDouble()*22; cn=5+rng.nextDouble()*20; or2=8+rng.nextDouble()*20; }
            CurriculumSkill weak = allSk.get(ci).get(rng.nextInt(allSk.get(ci).size()));
            CurriculumSkill strong = allSk.get(ci).get(rng.nextInt(allSk.get(ci).size()));
            String insight = or2 >= 60
                    ? String.format("%s 학생은 이해도 %.0f%%로 위험도가 높습니다. %s에서 즉각적인 학습 개입이 필요합니다.", stu[i].getName(), m, weak.getName())
                    : or2 >= 35
                    ? String.format("%s 학생은 중간 수준(%.0f%%)입니다. %s는 양호하나 %s에서 추가 학습이 필요합니다.", stu[i].getName(), m, strong.getName(), weak.getName())
                    : String.format("%s 학생은 우수한 성과(%.0f%%)를 보입니다. %s에서 특히 뛰어나며, 스터디 리더로 적합합니다.", stu[i].getName(), m, strong.getName());
            studentTwinRepository.save(StudentTwin.builder().student(stu[i]).course(cs[ci])
                    .masteryScore(bd(m)).executionScore(bd(e)).retentionRiskScore(bd(rr))
                    .motivationScore(bd(mo)).consultationNeedScore(bd(cn)).overallRiskScore(bd(or2))
                    .aiInsight(insight).build());
        }
        log.info("[Seed] Twins done");

        // ── Skill Mastery (3-5 snapshots per skill per student) ───────
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            for (CurriculumSkill sk : allSk.get(ci)) {
                int cnt = 3 + rng.nextInt(3);
                for (int s = 0; s < cnt; s++) {
                    double b = 30 + rng.nextDouble() * 60;
                    snapshotRepository.save(SkillMasterySnapshot.builder()
                            .student(stu[i]).course(cs[ci]).skill(sk)
                            .understandingScore(bd(clamp(b + rng.nextGaussian() * 10, 5, 98)))
                            .practiceScore(bd(clamp(b - 5 + rng.nextGaussian() * 12, 5, 98)))
                            .confidenceScore(bd(clamp(b + 2 + rng.nextGaussian() * 10, 5, 98)))
                            .forgettingRiskScore(bd(clamp(90 - b + rng.nextGaussian() * 10, 2, 90)))
                            .sourceType(s % 2 == 0 ? "REFLECTION_ANALYSIS" : "CODE_ANALYSIS").build());
                }
            }
        }
        log.info("[Seed] Skill mastery done");

        // ── Review Tasks (15-20 per student) ──────────────────────────
        String[][] rtTpl = {
                {"기본 개념 복습","이해도가 낮아 기본 개념부터 복습이 필요합니다."},
                {"실습 과제 재도전","실습 점수가 낮아 추가 연습이 필요합니다."},
                {"심화 문제 풀이","기초는 탄탄하지만 심화 연습이 필요합니다."},
                {"코드 리팩토링 연습","코드 품질 향상을 위한 리팩토링을 해보세요."},
                {"개념 정리 노트","핵심 개념을 정리하여 장기 기억으로 전환하세요."},
                {"페어 프로그래밍","동료와 함께 문제를 풀어보세요."},
                {"오류 디버깅 실습","에러를 분석하고 해결하는 연습을 하세요."},
                {"프로젝트 적용","배운 개념을 미니 프로젝트에 적용해보세요."},
                {"핵심 알고리즘 복습","기본 알고리즘을 복습하세요."},
                {"테스트 코드 작성","작성한 코드에 테스트를 추가해보세요."},
        };
        String[] rtStat = {"PENDING","PENDING","IN_PROGRESS","IN_PROGRESS","COMPLETED","COMPLETED","COMPLETED","COMPLETED","SKIPPED","PENDING"};
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            List<CurriculumSkill> sks = allSk.get(ci);
            int cnt = 15 + rng.nextInt(6);
            for (int t = 0; t < cnt; t++) {
                int ti = t % rtTpl.length;
                CurriculumSkill sk = sks.get(t % sks.size());
                String st = rtStat[t % rtStat.length];
                LocalDate sched = LocalDate.now().minusDays(rng.nextInt(21)).plusDays(rng.nextInt(7));
                ReviewTask task = ReviewTask.builder().student(stu[i]).course(cs[ci]).skill(sk)
                        .title(sk.getName() + " " + rtTpl[ti][0]).reasonSummary(rtTpl[ti][1])
                        .scheduledFor(sched).status(st).build();
                if ("COMPLETED".equals(st)) task.setCompletedAt(LocalDateTime.now().minusDays(rng.nextInt(14)));
                reviewTaskRepository.save(task);
            }
        }
        log.info("[Seed] Review tasks done");

        // ── Reflections (10-15 per student) ───────────────────────────
        String[][] rfTpl = {
                {"오늘 %s를 배웠는데, 기본 개념은 이해했지만 응용이 어렵다.","응용 문제에서 막힘","혼란","호기심"},
                {"드디어 %s 개념을 이해했다! 실습으로 해보니 이론과 다르게 느껴진다.",null,"성취감","자신감"},
                {"%s 과제 피드백에서 개선점이 있었다. 다음에는 더 잘할 수 있을 것 같다.","에러 핸들링","아쉬움","의지"},
                {"%s 수업에서 새로운 패턴을 배웠다. 기존 코드를 리팩토링하고 싶다.",null,"흥미","동기부여"},
                {"%s 관련 스터디에서 동료의 코드를 보고 새로운 시각을 얻었다.",null,"감탄","성장"},
                {"오늘 %s 실습을 2시간 연속으로 했다. 집중력이 많이 좋아졌다.",null,"뿌듯함","에너지"},
                {"%s에서 에러가 계속 나서 힘들었지만 결국 해결했다.","에러 원인 파악","좌절→성취","인내"},
                {"강사님의 %s 피드백을 받고 방향이 확실해졌다. 더 열심히 해야겠다.",null,"감사","결의"},
                {"%s 개념을 노트에 정리했더니 머릿속이 깔끔해졌다.",null,"정리됨","명확함"},
                {"오늘 %s 코드 리뷰를 받았는데 생각보다 좋은 평가를 받았다.",null,"놀람","자신감"},
                {"%s 관련 유튜브 강의를 추가로 봤다. 다른 관점에서 이해가 됐다.",null,"깨달음","호기심"},
                {"%s 복습을 했는데 2주 전에 배운 것이 기억나지 않아 다시 시작했다.","기억 유지 어려움","걱정","각오"},
        };
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            List<CurriculumSkill> sks = allSk.get(ci);
            int cnt = 10 + rng.nextInt(6);
            for (int r = 0; r < cnt; r++) {
                int ti = r % rfTpl.length;
                CurriculumSkill sk = sks.get(r % sks.size());
                reflectionRepository.save(Reflection.builder().student(stu[i]).course(cs[ci])
                        .content(String.format(rfTpl[ti][0], sk.getName())).stuckPoint(rfTpl[ti][1])
                        .selfConfidenceScore(1 + rng.nextInt(5))
                        .emotionSummary(Map.of("primary", rfTpl[ti][2], "secondary", rfTpl[ti][3]))
                        .aiAnalysisJson(Map.of("knowledgeGaps", List.of(sk.getName() + " 심화"),
                                "strengths", List.of(sk.getName() + " 기본"), "suggestion", sk.getName() + " 추가 실습 권장"))
                        .build());
            }
        }
        log.info("[Seed] Reflections done");

        // ── Consultations (5-8 per student) ───────────────────────────
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            int cnt = 5 + rng.nextInt(4);
            for (int c = 0; c < cnt; c++) {
                boolean done = c < cnt - 2;
                User instr = ins[c % 3];
                Consultation.ConsultationBuilder cb = Consultation.builder()
                        .student(stu[i]).instructor(instr).course(cs[ci])
                        .scheduledAt(done ? LocalDateTime.now().minusDays(1 + c * 3 + rng.nextInt(5)) : LocalDateTime.now().plusDays(1 + c))
                        .status(done ? "COMPLETED" : "SCHEDULED")
                        .notes(stu[i].getName() + " 학생 " + (done ? "학습 진행 상담" : "예정 상담"));
                if (done) {
                    cb.completedAt(LocalDateTime.now().minusDays(c * 3));
                    cb.summaryText(stu[i].getName() + " 학생과 취약 영역 보충 및 학습 전략을 논의함. 단계별 액션플랜 수립 완료.");
                    cb.causeAnalysis("실습 시간 부족과 기초 개념 미흡이 주요 원인으로 파악됨.");
                } else {
                    cb.briefingJson(Map.of("twinSummary", "학습 현황 점검 예정", "suggestedTopics", List.of("취약 영역 보강", "학습 목표 재설정")));
                }
                Consultation saved = consultationRepository.save(cb.build());
                if (done) {
                    int apCnt = 1 + rng.nextInt(3);
                    String[] apTitles = {"취약 스킬 복습 과제", "실습 프로젝트 수행", "매일 30분 코딩 습관", "스터디 그룹 참여", "개념 노트 정리"};
                    String[] apStats = {"COMPLETED", "IN_PROGRESS", "PENDING"};
                    for (int a = 0; a < apCnt; a++) {
                        actionPlanRepository.save(ActionPlan.builder()
                                .consultation(saved).student(stu[i]).course(cs[ci])
                                .title(apTitles[a % apTitles.length]).description("상담 결과에 따른 액션플랜입니다.")
                                .dueDate(LocalDate.now().plusDays(3 + a * 3))
                                .priority(a == 0 ? "HIGH" : "MEDIUM").status(apStats[a % apStats.length]).build());
                    }
                }
            }
        }
        log.info("[Seed] Consultations done");

        // ── Recommendations (5-8 per student) ─────────────────────────
        String[][] rcTpl = {
                {"REVIEW","%s 집중 복습 추천","%s 이해도가 낮습니다. 집중 복습을 추천합니다."},
                {"RESOURCE","%s 실습 자료 추천","%s 실습 향상을 위한 추가 자료를 추천합니다."},
                {"STUDY_GROUP","%s 스터디 참여","%s 향상을 위해 스터디 그룹 참여를 추천합니다."},
                {"REVIEW","%s 반복 학습","%s 기억 유지를 위해 반복 학습이 필요합니다."},
                {"RESOURCE","%s 심화 콘텐츠","%s 심화 과정 콘텐츠를 추천합니다."},
                {"REVIEW","%s 오답 분석","%s 관련 자주 틀리는 유형을 분석해보세요."},
                {"STUDY_GROUP","%s 코드 리뷰 참여","%s 코드 리뷰를 통해 실력을 키워보세요."},
                {"RESOURCE","%s 프로젝트 추천","배운 %s를 프로젝트에 적용해보세요."},
        };
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            List<CurriculumSkill> sks = allSk.get(ci);
            int cnt = 5 + rng.nextInt(4);
            for (int r = 0; r < cnt; r++) {
                int ti = r % rcTpl.length;
                CurriculumSkill sk = sks.get(r % sks.size());
                recommendationRepository.save(Recommendation.builder().student(stu[i]).course(cs[ci])
                        .recommendationType(rcTpl[ti][0]).title(String.format(rcTpl[ti][1], sk.getName()))
                        .reasonSummary(String.format(rcTpl[ti][2], sk.getName())).triggerEvent("TWIN_SCORE_DROP")
                        .evidencePayload(Map.of("skillName", sk.getName(), "studentName", stu[i].getName()))
                        .expectedOutcome("학습 성과 향상 예상").build());
            }
        }
        log.info("[Seed] Recommendations done");

        // ── Gamification (all 100, rich) ──────────────────────────────
        String[] lvlTitles = {"초보 학습자","성장하는 학습자","열정적 코더","중급 개발자","풀스택 학습자",
                "실력자","시니어 러너","코드 마스터","AI 분석가","풀스택 마스터","전설의 코더","그랜드 마스터"};
        List<Badge> badges = badgeRepository.findAll();
        String[] evTypes = {"REFLECTION_SUBMIT","REVIEW_COMPLETE","CODE_SUBMIT","CONSULTATION_ATTEND","CHATBOT_INTERACTION","STUDY_GROUP_JOIN","DAILY_LOGIN","STREAK_BONUS"};
        int[] evXp = {20, 15, 25, 35, 5, 20, 10, 30};

        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            int lvl = 1 + rng.nextInt(12);
            gamificationRepository.save(StudentGamification.builder().student(stu[i]).course(cs[ci])
                    .level(lvl).currentXp(rng.nextInt(200)).nextLevelXp(100 + lvl * 30)
                    .levelTitle(lvlTitles[Math.min(lvl - 1, lvlTitles.length - 1)])
                    .streakDays(rng.nextInt(30)).lastActivityDate(LocalDate.now().minusDays(rng.nextInt(3)))
                    .totalXpEarned(lvl * 250 + rng.nextInt(500)).build());
            int bc = Math.min(lvl / 2, badges.size());
            for (int b = 0; b < bc; b++) studentBadgeRepository.save(StudentBadge.builder().student(stu[i]).badge(badges.get(b)).build());
            int ec = 20 + rng.nextInt(11);
            for (int e = 0; e < ec; e++) {
                int idx = rng.nextInt(evTypes.length);
                xpEventRepository.save(XPEvent.builder().student(stu[i]).course(cs[ci]).eventType(evTypes[idx]).xpAmount(evXp[idx]).sourceType(evTypes[idx]).build());
            }
        }
        log.info("[Seed] Gamification done");

        // ── Chatbot Conversations (all 100 students, 2-3 each) ────────
        String[][] chatQ = {
                {"이해가 안 되는 부분이 있어요.","물론이죠! 어떤 부분이 어려우신가요? 기본 개념부터 설명해드릴게요."},
                {"실습에서 자꾸 에러가 나요.","디버깅은 체계적으로 접근하면 됩니다. 에러 메시지를 먼저 읽어보세요."},
                {"이 개념을 쉽게 설명해줄 수 있나요?","좋은 질문이에요! 일상 비유로 설명할게요."},
                {"복습 계획을 세워주세요.","현재 트윈 데이터 기반으로 맞춤형 복습 계획을 만들어드릴게요."},
                {"코드 리뷰해줄 수 있나요?","물론이죠! 코드를 보내주시면 개선점을 알려드릴게요."},
                {"시험 준비 어떻게 하면 좋을까요?","핵심 개념 정리 → 실습 → 모의 문제 순서로 준비하세요."},
        };
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            List<CurriculumSkill> sks = allSk.get(ci);
            int convCnt = 2 + rng.nextInt(2);
            for (int cv = 0; cv < convCnt; cv++) {
                CurriculumSkill sk = sks.get(rng.nextInt(sks.size()));
                Conversation conv = conversationRepository.save(Conversation.builder()
                        .student(stu[i]).course(cs[ci]).title(sk.getName() + " 학습 도우미").status("ACTIVE")
                        .twinContextJson(Map.of("currentSkill", sk.getName())).build());
                int msgCnt = 4 + rng.nextInt(4);
                for (int msg = 0; msg < msgCnt; msg++) {
                    int qi = msg / 2 % chatQ.length;
                    boolean isUser = msg % 2 == 0;
                    String content = isUser
                            ? sk.getName() + "에서 " + chatQ[qi][0]
                            : chatQ[qi][1] + " " + sk.getName() + "의 핵심은 기본 원리를 이해하는 것입니다.";
                    chatMessageRepository.save(ChatMessage.builder().conversation(conv)
                            .role(isUser ? "USER" : "ASSISTANT").content(content).tokenCount(50 + rng.nextInt(150)).build());
                }
            }
        }
        log.info("[Seed] Chatbot done");

        // ── Code Submissions (8-12 per student, all 100) ──────────────
        String[][] codeTpl = {
                {"javascript","function fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2);\n}"},
                {"javascript","const fetchData = async (url) => {\n  try {\n    const res = await fetch(url);\n    return await res.json();\n  } catch (e) {\n    console.error(e);\n  }\n}"},
                {"javascript","function Counter() {\n  const [count, setCount] = useState(0);\n  return <button onClick={() => setCount(c => c + 1)}>{count}</button>;\n}"},
                {"python","def merge_sort(arr):\n    if len(arr) <= 1:\n        return arr\n    mid = len(arr) // 2\n    left = merge_sort(arr[:mid])\n    right = merge_sort(arr[mid:])\n    return merge(left, right)"},
                {"python","import pandas as pd\n\ndef analyze(df):\n    return df.groupby('category').agg({'value': ['mean', 'std', 'count']})"},
                {"java","@GetMapping(\"/api/users\")\npublic ResponseEntity<List<UserDto>> getUsers() {\n    return ResponseEntity.ok(userService.findAll());\n}"},
                {"java","public int binarySearch(int[] arr, int target) {\n    int lo = 0, hi = arr.length - 1;\n    while (lo <= hi) {\n        int mid = (lo + hi) / 2;\n        if (arr[mid] == target) return mid;\n        else if (arr[mid] < target) lo = mid + 1;\n        else hi = mid - 1;\n    }\n    return -1;\n}"},
                {"typescript","interface User {\n  id: number;\n  name: string;\n}\nconst getUser = async (id: number): Promise<User> => {\n  const res = await fetch(`/api/users/${id}`);\n  return res.json();\n}"},
        };
        String[][] fbTpl = {
                {"GOOD","코드 구조가 깔끔합니다.","현재 상태를 유지하세요."},
                {"WARNING","에러 핸들링이 부족합니다.","try-catch 블록을 추가하세요."},
                {"ERROR","무한 재귀 위험이 있습니다.","기저 조건을 명확히 하세요."},
                {"INFO","성능 최적화 여지가 있습니다.","메모이제이션을 고려해보세요."},
                {"GOOD","RESTful 원칙을 잘 따릅니다.","이 패턴을 유지하세요."},
                {"WARNING","변수명이 모호합니다.","의미 있는 이름을 사용하세요."},
                {"INFO","함수 분리를 고려해보세요.","단일 책임 원칙을 적용하세요."},
                {"GOOD","타입 정의가 잘 되어 있습니다.","TypeScript 활용이 우수합니다."},
        };
        for (int i = 0; i < N; i++) {
            int ci = i < 70 ? 0 : (i < 90 ? 1 : 2);
            List<CurriculumSkill> sks = allSk.get(ci);
            int cnt = 8 + rng.nextInt(5);
            for (int s = 0; s < cnt; s++) {
                int cti = s % codeTpl.length;
                CurriculumSkill sk = sks.get(s % sks.size());
                CodeSubmission sub = codeSubmissionRepository.save(CodeSubmission.builder()
                        .student(stu[i]).course(cs[ci]).skill(sk)
                        .codeContent(codeTpl[cti][1]).language(codeTpl[cti][0]).status("ANALYZED").build());
                int fbCnt = 1 + rng.nextInt(3);
                for (int fb = 0; fb < fbCnt; fb++) {
                    int fi = (s + fb) % fbTpl.length;
                    codeFeedbackRepository.save(CodeFeedback.builder().submission(sub)
                            .lineNumber(1 + rng.nextInt(5)).endLineNumber(2 + rng.nextInt(5))
                            .severity(fbTpl[fi][0]).message(fbTpl[fi][1]).suggestion(fbTpl[fi][2])
                            .twinLinked(rng.nextBoolean()).twinSkill(rng.nextBoolean() ? sk : null).build());
                }
            }
        }
        log.info("[Seed] Code submissions done");

        // ── Study Groups (20 groups) ──────────────────────────────────
        String[][] grpData = {
                {"React 마스터즈","React 심화 학습"},{"Spring Boot 탐험대","백엔드 개발 학습"},
                {"알고리즘 챌린저스","매일 알고리즘 풀기"},{"풀스택 프로젝트팀","실전 프로젝트"},
                {"JavaScript 딥다이브","JS 심화"},{"CSS 아티스트","CSS 고급 기법"},
                {"코드 리뷰 클럽","서로 코드 리뷰"},{"TypeScript 전환반","TS 마이그레이션"},
                {"Python 데이터팀","데이터 분석"},{"통계 마스터","통계 심화 학습"},
                {"시각화 크루","데이터 시각화"},{"ML 입문반","머신러닝 기초"},
                {"UI 디자인 랩","UI 포트폴리오"},{"UX 리서치팀","사용성 테스트"},
                {"새벽 코딩 크루","아침 코딩 습관"},{"취업 준비반","포트폴리오/면접"},
                {"해커톤 준비팀","해커톤 대비"},{"오픈소스 기여팀","오픈소스 참여"},
                {"블로그 작성반","기술 블로그"},{"발표 연습반","기술 발표 연습"},
        };
        for (int g = 0; g < grpData.length; g++) {
            int ci = g < 8 ? 0 : (g < 14 ? 1 : 2);
            int li = g * 5 % N;
            StudyGroup grp = StudyGroup.builder().course(cs[ci]).name(grpData[g][0]).description(grpData[g][1])
                    .maxMembers(5).status("ACTIVE").createdBy(stu[li]).build();
            em.persist(grp);
            addMember(grp, stu[li], "LEADER", "그룹 리더", bd(0.95));
            for (int m2 = 1; m2 <= 3; m2++) {
                int mi = (li + m2) % N;
                addMember(grp, stu[mi], "MEMBER", "적극 참여자", bd(0.70 + rng.nextDouble() * 0.25));
            }
        }
        em.flush();
        log.info("[Seed] Complete! {} students, 3 courses, all tabs populated.", N);
    }

    // ── Helpers ────────────────────────────────────────────────────────
    private Course mkCourse(String t, String d, User ins, String[][] wks) {
        Course c = Course.builder().title(t).description(d).status("ACTIVE").createdBy(ins).build();
        for (int i = 0; i < wks.length; i++) c.getWeeks().add(CourseWeek.builder().course(c).weekNo(i + 1).title(wks[i][0]).summary(wks[i][1]).build());
        em.persist(c); return c;
    }
    private List<CurriculumSkill> mkSkills(Course c, String[][] d) {
        List<CurriculumSkill> l = new ArrayList<>();
        for (String[] s : d) { CurriculumSkill sk = CurriculumSkill.builder().course(c).name(s[0]).description(s[1]).difficulty(s[2]).build(); em.persist(sk); l.add(sk); }
        return l;
    }
    private void enroll(User s, Course c) { courseEnrollmentRepository.save(CourseEnrollment.builder().course(c).student(s).status("ACTIVE").build()); }
    private void addMember(StudyGroup g, User s, String role, String str, BigDecimal ms) {
        g.getMembers().add(StudyGroupMember.builder().studyGroup(g).student(s).role(role).strengthSummary(str).complementNote("상호 보완 학습").matchScore(ms).build());
    }
    private static BigDecimal bd(String v) { return new BigDecimal(v); }
    private static BigDecimal bd(double v) { return BigDecimal.valueOf(Math.round(v * 100.0) / 100.0).setScale(2, java.math.RoundingMode.HALF_UP); }
    private static double clamp(double v, double min, double max) { return Math.max(min, Math.min(max, v)); }
}

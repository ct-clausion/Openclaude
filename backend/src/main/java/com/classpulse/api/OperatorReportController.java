package com.classpulse.api;

import com.classpulse.domain.twin.StudentTwin;
import com.classpulse.domain.twin.StudentTwinRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@org.springframework.security.access.prepost.PreAuthorize("hasRole('OPERATOR')")
@RequestMapping("/api/operator")
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class OperatorReportController {

    private final StudentTwinRepository studentTwinRepository;

    @GetMapping("/reports/weekly")
    public ResponseEntity<Map<String, Object>> getWeeklyReport() {
        LocalDate now = LocalDate.now();
        List<StudentTwin> allTwins = studentTwinRepository.findAll();

        long atRiskCount = allTwins.stream()
                .filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                .count();
        long decliningCount = allTwins.stream()
                .filter(t -> "DECLINING".equals(t.getTrendDirection()))
                .count();

        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("totalStudentsAnalyzed", allTwins.size());
        summary.put("atRiskStudents", atRiskCount);
        summary.put("decliningStudents", decliningCount);
        summary.put("avgMastery", allTwins.stream().mapToDouble(t -> t.getMasteryScore().doubleValue()).average().orElse(0));
        summary.put("avgMotivation", allTwins.stream().mapToDouble(t -> t.getMotivationScore().doubleValue()).average().orElse(0));

        List<String> anomalies = new ArrayList<>();
        if (!allTwins.isEmpty() && atRiskCount > allTwins.size() * 0.3) {
            anomalies.add("이탈 위험 수강생 비율이 30%를 초과했습니다. 전체 과정 점검이 필요합니다.");
        }
        if (!allTwins.isEmpty() && decliningCount > allTwins.size() * 0.2) {
            anomalies.add("성적 하락 추세 수강생이 20%를 초과했습니다.");
        }

        List<String> recommendations = new ArrayList<>();
        if (atRiskCount > 0) {
            recommendations.add("이탈 위험 수강생 " + atRiskCount + "명에 대한 긴급 상담 배정을 권장합니다.");
        }
        recommendations.add("주간 출결 패턴을 분석하여 연속 결석자에 대한 선제적 개입을 실행하세요.");

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("periodStart", now.minusDays(7).toString());
        result.put("periodEnd", now.toString());
        result.put("summary", summary);
        result.put("anomalies", anomalies);
        result.put("recommendations", recommendations);
        return ResponseEntity.ok(result);
    }

    @PostMapping("/ai/simulate")
    public ResponseEntity<Map<String, Object>> simulate(@RequestBody Map<String, Object> body) {
        String scenarioType = (String) body.getOrDefault("scenarioType", "ADD_CONSULTATION");
        String targetStudentIdStr = body.get("targetStudentId") != null ? body.get("targetStudentId").toString() : null;
        String targetCourseIdStr = body.get("targetCourseId") != null ? body.get("targetCourseId").toString() : null;

        StudentTwin twin = null;
        if (targetStudentIdStr != null && targetCourseIdStr != null) {
            twin = studentTwinRepository.findByStudentIdAndCourseId(
                    Long.valueOf(targetStudentIdStr), Long.valueOf(targetCourseIdStr)
            ).orElse(null);
        } else if (targetStudentIdStr != null) {
            List<StudentTwin> twins = studentTwinRepository.findByStudentId(Long.valueOf(targetStudentIdStr));
            twin = twins.isEmpty() ? null : twins.get(0);
        }

        Map<String, Double> currentScores = new LinkedHashMap<>();
        Map<String, Double> projectedScores = new LinkedHashMap<>();
        String interpretation;
        String recommendation;
        double confidence;

        if (twin != null) {
            currentScores.put("mastery", twin.getMasteryScore().doubleValue());
            currentScores.put("execution", twin.getExecutionScore().doubleValue());
            currentScores.put("motivation", twin.getMotivationScore().doubleValue());
            currentScores.put("retentionRisk", twin.getRetentionRiskScore().doubleValue());
            currentScores.put("overallRisk", twin.getOverallRiskScore().doubleValue());

            switch (scenarioType) {
                case "ADD_CONSULTATION":
                    projectedScores.put("mastery", Math.min(100, twin.getMasteryScore().doubleValue() + 8));
                    projectedScores.put("execution", Math.min(100, twin.getExecutionScore().doubleValue() + 5));
                    projectedScores.put("motivation", Math.min(100, twin.getMotivationScore().doubleValue() + 12));
                    projectedScores.put("retentionRisk", Math.max(0, twin.getRetentionRiskScore().doubleValue() - 15));
                    projectedScores.put("overallRisk", Math.max(0, twin.getOverallRiskScore().doubleValue() - 10));
                    interpretation = "상담 배정 시 동기 점수가 +12, 이탈 위험이 -15% 개선될 것으로 예상됩니다. 특히 동기 부여 측면에서 가장 큰 효과가 기대됩니다.";
                    recommendation = "즉시 상담 배정을 권장합니다. 강사와의 1:1 면담이 이 수강생의 학습 지속에 가장 효과적인 개입입니다.";
                    confidence = 0.82;
                    break;
                case "ADD_SESSION":
                    projectedScores.put("mastery", Math.min(100, twin.getMasteryScore().doubleValue() + 15));
                    projectedScores.put("execution", Math.min(100, twin.getExecutionScore().doubleValue() + 10));
                    projectedScores.put("motivation", Math.min(100, twin.getMotivationScore().doubleValue() + 5));
                    projectedScores.put("retentionRisk", Math.max(0, twin.getRetentionRiskScore().doubleValue() - 20));
                    projectedScores.put("overallRisk", Math.max(0, twin.getOverallRiskScore().doubleValue() - 12));
                    interpretation = "보충 세션 추가 시 숙련도가 +15, 이탈 위험이 -20% 개선될 것으로 예상됩니다. 실행력도 함께 향상될 것입니다.";
                    recommendation = "3주차 난이도가 높은 구간에 보충 세션을 추가하면 과정 전체 수료율이 개선될 것으로 예상됩니다.";
                    confidence = 0.75;
                    break;
                default:
                    projectedScores.putAll(currentScores);
                    interpretation = "시나리오 분석 결과, 현재 상태 유지 시 점수 변화가 미미할 것으로 예상됩니다.";
                    recommendation = "다른 시나리오를 시도해보세요.";
                    confidence = 0.5;
            }
        } else {
            currentScores.put("mastery", 50.0);
            currentScores.put("execution", 50.0);
            currentScores.put("motivation", 50.0);
            currentScores.put("retentionRisk", 50.0);
            currentScores.put("overallRisk", 50.0);
            projectedScores.putAll(currentScores);
            interpretation = "대상 수강생의 Twin 데이터를 찾을 수 없습니다. 유효한 수강생 ID와 과정 ID를 입력해주세요.";
            recommendation = "Twin 데이터가 있는 수강생을 선택해주세요.";
            confidence = 0.0;
        }

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("currentScores", currentScores);
        result.put("projectedScores", projectedScores);
        result.put("confidence", confidence);
        result.put("aiInterpretation", interpretation);
        result.put("recommendation", recommendation);
        return ResponseEntity.ok(result);
    }

    @GetMapping("/ai/intervention-suggestions")
    public ResponseEntity<List<Map<String, Object>>> getInterventionSuggestions() {
        List<StudentTwin> atRiskTwins = studentTwinRepository.findAll().stream()
                .filter(t -> t.getOverallRiskScore().compareTo(new BigDecimal("70")) > 0)
                .sorted((a, b) -> b.getOverallRiskScore().compareTo(a.getOverallRiskScore()))
                .limit(10)
                .collect(Collectors.toList());

        List<Map<String, Object>> suggestions = atRiskTwins.stream().map(t -> {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("studentId", t.getStudent().getId());
            m.put("studentName", t.getStudent().getName());
            m.put("courseTitle", t.getCourse().getTitle());

            double risk = t.getOverallRiskScore().doubleValue();
            if (risk >= 85) {
                m.put("suggestedAction", "긴급 1:1 상담 배정 + 보충 자료 제공");
                m.put("urgency", "HIGH");
                m.put("expectedImpact", "이탈 위험 -20% 예상");
            } else {
                m.put("suggestedAction", "강사에게 주의 알림 + 학습 점검");
                m.put("urgency", "MEDIUM");
                m.put("expectedImpact", "이탈 위험 -10% 예상");
            }
            return m;
        }).collect(Collectors.toList());

        return ResponseEntity.ok(suggestions);
    }
}

import React, { useRef, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { EditorView, keymap, lineNumbers, highlightActiveLine, Decoration } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { cpp } from '@codemirror/lang-cpp';
import { oneDark } from '@codemirror/theme-one-dark';
import { useCodeEditor } from '../../hooks/useCodeEditor';
import { codeAnalysisApi } from '../../api/codeAnalysis';
import { pollJob } from '../../api/jobs';
import { useCourseId } from '../../hooks/useCourseId';
import CodeAIFeedbackSidebar from './CodeAIFeedbackSidebar';
import type { CodeFeedback } from '../../types';

const MOCK_FEEDBACKS: CodeFeedback[] = [
  {
    id: 'f1',
    submissionId: 'sub1',
    lineNumber: 3,
    endLineNumber: 3,
    severity: 'WARNING',
    message: 'let 대신 const를 사용하세요. result는 재할당되지 않습니다.',
    suggestion: 'const result = [];',
    twinLinked: false,
    twinSkillId: null,
  },
  {
    id: 'f2',
    submissionId: 'sub1',
    lineNumber: 4,
    endLineNumber: 6,
    severity: 'INFO',
    message: 'filter + map 조합으로 더 간결하게 작성할 수 있어요.',
    suggestion: 'return arr.filter(x => x > 0).map(x => x * 2);',
    twinLinked: true,
    twinSkillId: 'sk1',
  },
  {
    id: 'f3',
    submissionId: 'sub1',
    lineNumber: 1,
    endLineNumber: 1,
    severity: 'GOOD',
    message: '함수 이름이 명확하고 좋습니다.',
    suggestion: '',
    twinLinked: false,
    twinSkillId: null,
  },
];

// ── Line highlight decorations ──────────────────────────────

const warningLineDeco = Decoration.line({ class: 'cm-warning-line' });
const errorLineDeco = Decoration.line({ class: 'cm-error-line' });
const activeLineDeco = Decoration.line({ class: 'cm-active-feedback-line' });

const setHighlightedLines = StateEffect.define<{
  warningLines: Set<number>;
  errorLines: Set<number>;
  activeLine: number | null;
}>();

const highlightedLinesField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none;
  },
  update(decos, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHighlightedLines)) {
        const { warningLines, errorLines, activeLine } = effect.value;
        const builder: { from: number; deco: Decoration }[] = [];
        const doc = tr.state.doc;

        if (doc.length === 0) return Decoration.none;

        for (let i = 1; i <= doc.lines; i++) {
          const lineStart = doc.line(i).from;
          if (activeLine === i) {
            builder.push({ from: lineStart, deco: activeLineDeco });
          } else if (errorLines.has(i)) {
            builder.push({ from: lineStart, deco: errorLineDeco });
          } else if (warningLines.has(i)) {
            builder.push({ from: lineStart, deco: warningLineDeco });
          }
        }

        return Decoration.set(
          builder.map((b) => b.deco.range(b.from)),
        );
      }
    }
    if (tr.docChanged) {
      return decos.map(tr.changes);
    }
    return decos;
  },
  provide: (f) => EditorView.decorations.from(f),
});

// ── Language config ─────────────────────────────────────────
const LANGUAGES = [
  { value: 'javascript', label: 'JavaScript', ext: () => javascript({ typescript: false, jsx: true }) },
  { value: 'typescript', label: 'TypeScript', ext: () => javascript({ typescript: true, jsx: true }) },
  { value: 'python', label: 'Python', ext: () => python() },
  { value: 'java', label: 'Java', ext: () => java() },
  { value: 'cpp', label: 'C / C++', ext: () => cpp() },
] as const;

// Custom theme overrides so the editor blends with slate-900 background
const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
  },
  '.cm-scroller': {
    overflow: 'auto',
  },
  '.cm-content': {
    caretColor: '#818cf8',
  },
  '.cm-warning-line': {
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  '.cm-error-line': {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
  },
  '.cm-active-feedback-line': {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
  },
});

interface CodeEditorPanelProps {
  courseId?: string;
  skillId?: string;
}

const CodeEditorPanel: React.FC<CodeEditorPanelProps> = ({
  courseId: courseIdProp,
  skillId,
}) => {
  const defaultCourseId = useCourseId();
  const courseId = courseIdProp ?? defaultCourseId;
  const {
    code,
    setCode,
    language,
    setLanguage,
    feedbacks,
    setFeedbacks,
    isSubmitting,
    setIsSubmitting,
    activeLineHighlight,
    setActiveLineHighlight,
  } = useCodeEditor();

  const langConfig = LANGUAGES.find((l) => l.value === language) ?? LANGUAGES[0];

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | null>(null);

  const displayFeedbacks = feedbacks.length > 0 ? feedbacks : MOCK_FEEDBACKS;

  // Compute highlighted lines from feedbacks
  const { warningLines, errorLines } = useMemo(() => {
    const wLines = new Set<number>();
    const eLines = new Set<number>();
    for (const f of displayFeedbacks) {
      if (f.severity === 'WARNING') {
        for (let l = f.lineNumber; l <= f.endLineNumber; l++) wLines.add(l);
      } else if (f.severity === 'ERROR') {
        for (let l = f.lineNumber; l <= f.endLineNumber; l++) eLines.add(l);
      }
    }
    return { warningLines: wLines, errorLines: eLines };
  }, [displayFeedbacks]);

  // Initialize CodeMirror
  useEffect(() => {
    if (!editorContainerRef.current) return;

    const updateListener = EditorView.updateListener.of((update: ViewUpdate) => {
      if (update.docChanged) {
        const newCode = update.state.doc.toString();
        setCode(newCode);
      }
    });

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        langConfig.ext(),
        oneDark,
        editorTheme,
        highlightedLinesField,
        updateListener,
        EditorView.lineWrapping,
        keymap.of([]),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorContainerRef.current,
    });

    editorViewRef.current = view;

    return () => {
      view.destroy();
      editorViewRef.current = null;
    };
    // Re-create editor when language changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Sync highlighted lines + active line into CodeMirror
  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;

    view.dispatch({
      effects: setHighlightedLines.of({
        warningLines,
        errorLines,
        activeLine: activeLineHighlight,
      }),
    });
  }, [warningLines, errorLines, activeLineHighlight]);

  const handleAnalyze = async () => {
    if (!courseId) {
      setFeedbacks(MOCK_FEEDBACKS);
      return;
    }
    setIsSubmitting(true);
    try {
      const submission = await codeAnalysisApi.submitCode({
        courseId: Number(courseId),
        skillId: skillId ? Number(skillId) : null,
        codeContent: code,
        language,
      });

      // Poll the async job until AI analysis completes
      const job = await pollJob(submission.jobId, { intervalMs: 1500, timeoutMs: 90_000 });

      if (job.status === 'COMPLETED') {
        // Fetch the actual AI-generated feedbacks
        const feedbacks = await codeAnalysisApi.getFeedback(String(submission.submissionId));
        setFeedbacks(feedbacks.length > 0 ? feedbacks : MOCK_FEEDBACKS);
      } else {
        // Job failed, fall back to mock
        console.error('Code analysis job failed:', job.errorMessage);
        setFeedbacks(MOCK_FEEDBACKS);
      }
    } catch (err) {
      console.error('Code analysis error:', err);
      setFeedbacks(MOCK_FEEDBACKS);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-900">코드 에디터</h2>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-xs text-slate-600 bg-slate-100 rounded px-2 py-1 border-none outline-none cursor-pointer hover:bg-slate-200 transition-colors"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={isSubmitting}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {isSubmitting ? (
            <>
              <svg
                className="animate-spin w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              분석 중...
            </>
          ) : (
            <>AI 분석 요청</>
          )}
        </button>
      </div>

      {/* Editor + Sidebar */}
      <div className="flex" style={{ minHeight: 320, maxHeight: 1000 }}>
        {/* CodeMirror Editor */}
        <div
          ref={editorContainerRef}
          className="flex-1 overflow-auto bg-slate-900"
          style={{ minHeight: 320, maxHeight: 1000 }}
        />

        {/* AI Feedback Sidebar */}
        <CodeAIFeedbackSidebar
          feedbacks={displayFeedbacks}
          onFeedbackHover={setActiveLineHighlight}
        />
      </div>
    </motion.div>
  );
};

export default CodeEditorPanel;

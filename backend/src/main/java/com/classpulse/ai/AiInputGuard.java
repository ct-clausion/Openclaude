package com.classpulse.ai;

/**
 * Hard limits for any user-controlled text that flows into an LLM prompt.
 * - Caps OpenAI token cost.
 * - Makes prompt injection noticeably harder (a payload has less room to stage
 *   "ignore previous instructions" style attacks).
 */
public final class AiInputGuard {

    /** Free-form user chat turn. ~1000 tokens. */
    public static final int MAX_CHAT_MESSAGE_CHARS = 5_000;

    /** Student answer for practice/evaluation endpoints. ~1500 tokens. */
    public static final int MAX_STUDENT_ANSWER_CHARS = 6_000;

    /** Code submission for AI review. ~5000 tokens. */
    public static final int MAX_CODE_CHARS = 20_000;

    /** Curriculum text (uploaded content). ~15000 tokens. */
    public static final int MAX_CURRICULUM_CHARS = 60_000;

    private AiInputGuard() {}

    public static String truncate(String input, int max) {
        if (input == null) return "";
        if (input.length() <= max) return input;
        return input.substring(0, max) + "\n\n[...내용이 길어 일부만 반영되었습니다]";
    }
}

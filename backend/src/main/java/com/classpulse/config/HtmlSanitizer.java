package com.classpulse.config;

/**
 * Defense-in-depth for user-authored text that gets stored and later rendered.
 * The frontend currently renders these as plain text (whitespace-pre-wrap), but
 * a future change to HTML rendering would turn any stored `<script>…</script>`
 * into persistent XSS. Sanitizing on write keeps that class of bug off the table.
 *
 * HTML-escapes `<`, `>`, `&`, `"`, `'`. Does NOT strip — history is preserved so
 * users who did mean to paste angle brackets still see them literally.
 */
public final class HtmlSanitizer {

    private HtmlSanitizer() {}

    public static String escape(String input) {
        if (input == null) return null;
        StringBuilder out = new StringBuilder(input.length());
        for (int i = 0; i < input.length(); i++) {
            char c = input.charAt(i);
            switch (c) {
                case '<' -> out.append("&lt;");
                case '>' -> out.append("&gt;");
                case '&' -> out.append("&amp;");
                case '"' -> out.append("&quot;");
                case '\'' -> out.append("&#x27;");
                default -> out.append(c);
            }
        }
        return out.toString();
    }
}

package com.codequest.challenge;

public enum PracticeMode {
    BUG_HUNT,
    TEST_FIRST,
    OUTPUT_TRACING,
    EDGE_CASE_RESCUE,
    /**
     * Student studies an already-fixed example (buggy + correct + commented diff)
     * before attempting an analog. Cognitive-load research shows novices learn
     * debugging faster from worked examples than from fresh attempts.
     */
    WORKED_EXAMPLE
}

package com.codequest.classroom;

import com.codequest.challenge.PracticeMode;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "assignments")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Assignment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(updatable = false, nullable = false)
    private UUID id;

    @Column(name = "classroom_id", nullable = false)
    private UUID classroomId;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String description = "";

    @Column(name = "target_topic", length = 80)
    private String targetTopic;

    @Enumerated(EnumType.STRING)
    @Column(name = "target_practice_mode", length = 40)
    private PracticeMode targetPracticeMode;

    @Column(name = "target_count", nullable = false)
    private int targetCount = 3;

    @Column(name = "due_at", nullable = false)
    private Instant dueAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false, nullable = false)
    private Instant createdAt;

    public static Assignment create(UUID classroomId, String title, String description,
                                    String targetTopic, PracticeMode targetPracticeMode,
                                    int targetCount, Instant dueAt) {
        Assignment a = new Assignment();
        a.classroomId = classroomId;
        a.title = title;
        a.description = description == null ? "" : description;
        a.targetTopic = targetTopic;
        a.targetPracticeMode = targetPracticeMode;
        a.targetCount = Math.max(1, targetCount);
        a.dueAt = dueAt;
        return a;
    }
}

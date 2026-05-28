package com.codequest.classroom;

import com.codequest.challenge.PracticeMode;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public class AssignmentDto {

    public record CreateRequest(
            @NotNull UUID teacherId,
            @NotBlank @Size(max = 160) String title,
            String description,
            String targetTopic,
            PracticeMode targetPracticeMode,
            @Min(1) Integer targetCount,
            @NotNull Instant dueAt
    ) {}

    public record AssignmentResponse(
            UUID id,
            UUID classroomId,
            String classroomName,
            String title,
            String description,
            String targetTopic,
            PracticeMode targetPracticeMode,
            int targetCount,
            Instant dueAt,
            Instant createdAt,
            // Populated when fetched for a specific player:
            Integer completedCount,
            Boolean completed,
            Boolean overdue
    ) {
        public static AssignmentResponse withoutProgress(Assignment a, String classroomName) {
            return new AssignmentResponse(
                    a.getId(), a.getClassroomId(), classroomName,
                    a.getTitle(), a.getDescription(),
                    a.getTargetTopic(), a.getTargetPracticeMode(),
                    a.getTargetCount(), a.getDueAt(), a.getCreatedAt(),
                    null, null, null
            );
        }

        public static AssignmentResponse withProgress(Assignment a, String classroomName, int completedCount, Instant now) {
            boolean completed = completedCount >= a.getTargetCount();
            boolean overdue = !completed && now.isAfter(a.getDueAt());
            return new AssignmentResponse(
                    a.getId(), a.getClassroomId(), classroomName,
                    a.getTitle(), a.getDescription(),
                    a.getTargetTopic(), a.getTargetPracticeMode(),
                    a.getTargetCount(), a.getDueAt(), a.getCreatedAt(),
                    completedCount, completed, overdue
            );
        }
    }
}

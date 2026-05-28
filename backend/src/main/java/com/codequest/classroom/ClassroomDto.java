package com.codequest.classroom;

import com.codequest.player.PlayerLevel;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public class ClassroomDto {

    public record CreateRequest(
            @NotNull UUID ownerPlayerId,
            @NotBlank @Size(max = 120) String name
    ) {}

    public record JoinRequest(
            @NotNull UUID playerId,
            @NotBlank String joinCode
    ) {}

    public record ClassroomResponse(
            UUID id,
            String name,
            UUID ownerPlayerId,
            String joinCode,
            int memberCount,
            ClassroomMember.Role role,
            Instant createdAt
    ) {}

    public record MemberStat(
            UUID playerId,
            String username,
            ClassroomMember.Role role,
            PlayerLevel level,
            int totalXp,
            int currentStreak,
            int attemptsLast7Days,
            int correctRateLast7Days,
            String topMisconception,
            String weakestSkill,
            Instant joinedAt
    ) {}

    public record DashboardResponse(
            ClassroomResponse classroom,
            int totalStudents,
            int activeStudentsLast7Days,
            int avgCorrectRateLast7Days,
            List<MisconceptionCount> commonMisconceptions,
            List<SkillCount> weakSkills,
            List<MemberStat> members
    ) {}

    public record MisconceptionCount(String misconception, int count) {}
    public record SkillCount(String category, int attempts, double avgConfidence) {}

    // ── Deep-dive (one student, viewable by a TEACHER of the classroom) ──────

    public record AttemptItem(
            UUID challengeId,
            String topic,
            String bugPattern,
            String verdict,
            String misconception,
            int hintLevel,
            int durationSec,
            Instant createdAt
    ) {}

    public record TutorMessageItem(
            String role,
            String content,
            Instant createdAt
    ) {}

    public record ChallengeTranscript(
            UUID challengeId,
            String topic,
            List<TutorMessageItem> messages
    ) {}

    public record StudentDeepDive(
            UUID playerId,
            String username,
            PlayerLevel level,
            int totalXp,
            int currentStreak,
            List<AttemptItem> recentAttempts,
            List<ChallengeTranscript> recentTranscripts
    ) {}
}

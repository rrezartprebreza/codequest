package com.codequest.classroom;

import com.codequest.challenge.PracticeMode;
import com.codequest.learning.LearningAttempt;
import com.codequest.learning.LearningAttemptRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AssignmentService {

    private final AssignmentRepository assignmentRepository;
    private final ClassroomRepository classroomRepository;
    private final ClassroomMemberRepository memberRepository;
    private final LearningAttemptRepository attemptRepository;

    @Transactional
    public AssignmentDto.AssignmentResponse create(UUID classroomId, AssignmentDto.CreateRequest request) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found"));

        ClassroomMember membership = memberRepository
                .findByClassroomIdAndPlayerId(classroomId, request.teacherId())
                .orElseThrow(() -> new IllegalArgumentException("Not a member of this classroom"));

        if (membership.getRole() != ClassroomMember.Role.TEACHER) {
            throw new IllegalArgumentException("Only teachers can create assignments");
        }

        if (request.dueAt().isBefore(Instant.now())) {
            throw new IllegalArgumentException("Due date must be in the future");
        }

        Assignment created = assignmentRepository.save(Assignment.create(
                classroomId,
                request.title().trim(),
                request.description() == null ? "" : request.description().trim(),
                blankToNull(request.targetTopic()),
                request.targetPracticeMode(),
                request.targetCount() == null ? 3 : request.targetCount(),
                request.dueAt()
        ));

        return AssignmentDto.AssignmentResponse.withoutProgress(created, classroom.getName());
    }

    @Transactional(readOnly = true)
    public List<AssignmentDto.AssignmentResponse> listForClassroom(UUID classroomId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found"));

        return assignmentRepository.findByClassroomIdOrderByDueAtAsc(classroomId).stream()
                .map(a -> AssignmentDto.AssignmentResponse.withoutProgress(a, classroom.getName()))
                .toList();
    }

    /**
     * Lists assignments a player needs to complete (across every classroom they joined as STUDENT).
     * Progress is derived from learning_attempts created after the assignment was created.
     */
    @Transactional(readOnly = true)
    public List<AssignmentDto.AssignmentResponse> listForPlayer(UUID playerId) {
        List<ClassroomMember> memberships = memberRepository.findByPlayerId(playerId).stream()
                .filter(m -> m.getRole() == ClassroomMember.Role.STUDENT)
                .toList();
        if (memberships.isEmpty()) return List.of();

        List<UUID> classroomIds = memberships.stream().map(ClassroomMember::getClassroomId).toList();
        Map<UUID, String> classroomNames = classroomRepository.findAllById(classroomIds).stream()
                .collect(java.util.stream.Collectors.toMap(Classroom::getId, Classroom::getName));

        List<Assignment> assignments = assignmentRepository.findByClassroomIdInOrderByDueAtAsc(classroomIds);
        if (assignments.isEmpty()) return List.of();

        List<LearningAttempt> attempts = attemptRepository.findTop300ByPlayerIdOrderByCreatedAtDesc(playerId);
        Instant now = Instant.now();

        List<AssignmentDto.AssignmentResponse> out = new ArrayList<>();
        for (Assignment a : assignments) {
            int completed = countMatchingAttempts(attempts, a);
            out.add(AssignmentDto.AssignmentResponse.withProgress(
                    a, classroomNames.getOrDefault(a.getClassroomId(), ""), completed, now));
        }
        // Sort: incomplete + not-overdue first, then by due date
        out.sort(Comparator
                .<AssignmentDto.AssignmentResponse, Boolean>comparing(r -> Boolean.TRUE.equals(r.completed()))
                .thenComparing(Comparator.comparing(AssignmentDto.AssignmentResponse::dueAt)));
        return out;
    }

    /**
     * Returns per-student completion counts for one assignment.
     * Map: playerId -> completed count.
     */
    @Transactional(readOnly = true)
    public Map<UUID, Integer> completionsByPlayer(UUID classroomId, UUID assignmentId) {
        Assignment assignment = assignmentRepository.findById(assignmentId)
                .orElseThrow(() -> new IllegalArgumentException("Assignment not found"));
        if (!assignment.getClassroomId().equals(classroomId)) {
            throw new IllegalArgumentException("Assignment does not belong to this classroom");
        }

        List<UUID> studentIds = memberRepository.findByClassroomId(classroomId).stream()
                .filter(m -> m.getRole() == ClassroomMember.Role.STUDENT)
                .map(ClassroomMember::getPlayerId)
                .toList();

        Map<UUID, Integer> result = new HashMap<>();
        for (UUID studentId : studentIds) {
            List<LearningAttempt> attempts = attemptRepository.findTop300ByPlayerIdOrderByCreatedAtDesc(studentId);
            result.put(studentId, countMatchingAttempts(attempts, assignment));
        }
        return result;
    }

    private int countMatchingAttempts(List<LearningAttempt> attempts, Assignment assignment) {
        String wantedTopic = assignment.getTargetTopic() == null
                ? null
                : assignment.getTargetTopic().toLowerCase(Locale.ROOT);
        PracticeMode wantedMode = assignment.getTargetPracticeMode();

        return (int) attempts.stream()
                .filter(a -> !a.getCreatedAt().isBefore(assignment.getCreatedAt()))
                .filter(a -> "CORRECT".equals(a.getVerdict()))
                .filter(a -> wantedMode == null || a.getPracticeMode() == wantedMode)
                .filter(a -> {
                    if (wantedTopic == null) return true;
                    String categories = a.getCategories();
                    return categories != null && categories.toLowerCase(Locale.ROOT).contains(wantedTopic);
                })
                .count();
    }

    private String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}

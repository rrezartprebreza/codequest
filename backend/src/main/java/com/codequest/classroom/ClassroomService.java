package com.codequest.classroom;

import com.codequest.challenge.Challenge;
import com.codequest.challenge.ChallengeRepository;
import com.codequest.common.exception.PlayerNotFoundException;
import com.codequest.learning.LearningAttempt;
import com.codequest.learning.LearningAttemptRepository;
import com.codequest.learning.LearningCategoryStat;
import com.codequest.learning.LearningCategoryStatRepository;
import com.codequest.player.Player;
import com.codequest.player.PlayerRepository;
import com.codequest.tutor.TutorMessage;
import com.codequest.tutor.TutorMessageRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class ClassroomService {

    private static final String JOIN_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
    private static final int JOIN_CODE_LENGTH = 6;
    private static final SecureRandom RANDOM = new SecureRandom();

    private final ClassroomRepository classroomRepository;
    private final ClassroomMemberRepository memberRepository;
    private final PlayerRepository playerRepository;
    private final LearningAttemptRepository attemptRepository;
    private final LearningCategoryStatRepository categoryStatRepository;
    private final ChallengeRepository challengeRepository;
    private final TutorMessageRepository tutorMessageRepository;

    @Transactional
    public ClassroomDto.ClassroomResponse create(ClassroomDto.CreateRequest request) {
        Player owner = playerRepository.findById(request.ownerPlayerId())
                .orElseThrow(() -> new PlayerNotFoundException(request.ownerPlayerId()));

        Classroom classroom = Classroom.create(request.name().trim(), owner.getId(), generateUniqueJoinCode());
        classroom = classroomRepository.save(classroom);

        // Owner is automatically a teacher member.
        memberRepository.save(ClassroomMember.create(classroom.getId(), owner.getId(), ClassroomMember.Role.TEACHER));

        return toResponse(classroom, 1, ClassroomMember.Role.TEACHER);
    }

    @Transactional
    public ClassroomDto.ClassroomResponse join(ClassroomDto.JoinRequest request) {
        Player player = playerRepository.findById(request.playerId())
                .orElseThrow(() -> new PlayerNotFoundException(request.playerId()));
        Classroom classroom = classroomRepository.findByJoinCode(request.joinCode().trim().toUpperCase())
                .orElseThrow(() -> new IllegalArgumentException("Invalid join code"));

        ClassroomMember existing = memberRepository.findByClassroomIdAndPlayerId(classroom.getId(), player.getId())
                .orElse(null);
        if (existing == null) {
            memberRepository.save(ClassroomMember.create(classroom.getId(), player.getId(), ClassroomMember.Role.STUDENT));
        }

        List<ClassroomMember> members = memberRepository.findByClassroomId(classroom.getId());
        ClassroomMember.Role role = existing != null ? existing.getRole() : ClassroomMember.Role.STUDENT;
        return toResponse(classroom, members.size(), role);
    }

    @Transactional(readOnly = true)
    public List<ClassroomDto.ClassroomResponse> listForPlayer(UUID playerId) {
        List<ClassroomMember> memberships = memberRepository.findByPlayerId(playerId);
        if (memberships.isEmpty()) return List.of();

        Map<UUID, ClassroomMember.Role> roleByClassroom = memberships.stream()
                .collect(Collectors.toMap(ClassroomMember::getClassroomId, ClassroomMember::getRole, (a, b) -> a));

        List<Classroom> classrooms = classroomRepository.findAllById(roleByClassroom.keySet());
        Map<UUID, Integer> memberCounts = countMembersByClassroom(classrooms.stream().map(Classroom::getId).toList());

        return classrooms.stream()
                .sorted(Comparator.comparing(Classroom::getCreatedAt).reversed())
                .map(c -> toResponse(c, memberCounts.getOrDefault(c.getId(), 0), roleByClassroom.get(c.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public ClassroomDto.DashboardResponse getDashboard(UUID classroomId, UUID requesterPlayerId) {
        Classroom classroom = classroomRepository.findById(classroomId)
                .orElseThrow(() -> new IllegalArgumentException("Classroom not found"));

        ClassroomMember requesterMembership = memberRepository
                .findByClassroomIdAndPlayerId(classroomId, requesterPlayerId)
                .orElseThrow(() -> new IllegalArgumentException("Not a member of this classroom"));

        if (requesterMembership.getRole() != ClassroomMember.Role.TEACHER) {
            throw new IllegalArgumentException("Only teachers can view the classroom dashboard");
        }

        List<ClassroomMember> members = memberRepository.findByClassroomId(classroomId);
        List<UUID> studentIds = members.stream()
                .filter(m -> m.getRole() == ClassroomMember.Role.STUDENT)
                .map(ClassroomMember::getPlayerId)
                .toList();

        Map<UUID, Player> playersById = playerRepository.findAllById(
                members.stream().map(ClassroomMember::getPlayerId).toList()
        ).stream().collect(Collectors.toMap(Player::getId, p -> p));

        Instant weekAgo = Instant.now().minus(7, ChronoUnit.DAYS);

        // Build per-member stats
        List<ClassroomDto.MemberStat> memberStats = members.stream()
                .map(m -> buildMemberStat(m, playersById.get(m.getPlayerId()), weekAgo))
                .filter(stat -> stat != null)
                .sorted(Comparator.comparingInt(ClassroomDto.MemberStat::totalXp).reversed())
                .toList();

        // Cohort aggregates — only over students (skip teachers in totals)
        List<ClassroomDto.MemberStat> studentStats = memberStats.stream()
                .filter(s -> s.role() == ClassroomMember.Role.STUDENT)
                .toList();

        int activeLast7 = (int) studentStats.stream().filter(s -> s.attemptsLast7Days() > 0).count();
        int avgCorrectRate = studentStats.isEmpty()
                ? 0
                : (int) Math.round(studentStats.stream().mapToInt(ClassroomDto.MemberStat::correctRateLast7Days).average().orElse(0));

        List<ClassroomDto.MisconceptionCount> misconceptions = aggregateMisconceptions(studentIds, weekAgo);
        List<ClassroomDto.SkillCount> weakSkills = aggregateWeakSkills(studentIds);

        ClassroomDto.ClassroomResponse classroomResponse = toResponse(classroom, members.size(), requesterMembership.getRole());

        return new ClassroomDto.DashboardResponse(
                classroomResponse,
                studentIds.size(),
                activeLast7,
                avgCorrectRate,
                misconceptions,
                weakSkills,
                memberStats
        );
    }

    /**
     * Teacher view: one student's recent attempts + tutor transcripts for the
     * most recent challenges. Requires the requester to be a TEACHER of this
     * classroom and the target to be a member.
     */
    @Transactional(readOnly = true)
    public ClassroomDto.StudentDeepDive getStudentDeepDive(UUID classroomId, UUID requesterId, UUID studentId) {
        ClassroomMember requester = memberRepository
                .findByClassroomIdAndPlayerId(classroomId, requesterId)
                .orElseThrow(() -> new IllegalArgumentException("Not a member of this classroom"));
        if (requester.getRole() != ClassroomMember.Role.TEACHER) {
            throw new IllegalArgumentException("Only teachers can view student deep-dives");
        }
        memberRepository.findByClassroomIdAndPlayerId(classroomId, studentId)
                .orElseThrow(() -> new IllegalArgumentException("Target student is not in this classroom"));

        Player player = playerRepository.findById(studentId)
                .orElseThrow(() -> new PlayerNotFoundException(studentId));

        List<LearningAttempt> attempts = attemptRepository.findTop300ByPlayerIdOrderByCreatedAtDesc(player.getId());
        Map<UUID, Challenge> challengesById = new HashMap<>();
        challengeRepository.findAllById(attempts.stream().map(LearningAttempt::getChallengeId).distinct().toList())
                .forEach(c -> challengesById.put(c.getId(), c));

        List<ClassroomDto.AttemptItem> recent = attempts.stream()
                .limit(20)
                .map(a -> new ClassroomDto.AttemptItem(
                        a.getChallengeId(),
                        challengesById.containsKey(a.getChallengeId())
                                ? challengesById.get(a.getChallengeId()).getTopic()
                                : a.getBugPattern(),
                        a.getBugPattern(),
                        a.getVerdict(),
                        a.getMisconception(),
                        a.getHintLevel(),
                        a.getDurationSec(),
                        a.getCreatedAt()
                ))
                .toList();

        // Pull transcripts for the 3 most recent distinct challenges.
        List<UUID> recentChallengeIds = attempts.stream()
                .map(LearningAttempt::getChallengeId)
                .distinct()
                .limit(3)
                .toList();

        List<ClassroomDto.ChallengeTranscript> transcripts = new ArrayList<>();
        for (UUID challengeId : recentChallengeIds) {
            List<TutorMessage> messages = tutorMessageRepository
                    .findByPlayerIdAndChallengeIdOrderByCreatedAtAsc(player.getId(), challengeId);
            if (messages.isEmpty()) continue;
            String topic = challengesById.containsKey(challengeId)
                    ? challengesById.get(challengeId).getTopic()
                    : "Challenge";
            transcripts.add(new ClassroomDto.ChallengeTranscript(
                    challengeId,
                    topic,
                    messages.stream()
                            .map(m -> new ClassroomDto.TutorMessageItem(m.getRole(), m.getContent(), m.getCreatedAt()))
                            .toList()
            ));
        }

        return new ClassroomDto.StudentDeepDive(
                player.getId(),
                player.getUsername(),
                player.getLevel(),
                player.getTotalXp(),
                player.getCurrentStreak(),
                recent,
                transcripts
        );
    }

    private ClassroomDto.MemberStat buildMemberStat(ClassroomMember member, Player player, Instant weekAgo) {
        if (player == null) return null;
        List<LearningAttempt> recent = attemptRepository.findTop300ByPlayerIdOrderByCreatedAtDesc(player.getId());
        List<LearningAttempt> last7 = recent.stream().filter(a -> a.getCreatedAt().isAfter(weekAgo)).toList();

        int attempts7 = last7.size();
        int correct7 = (int) last7.stream().filter(a -> "CORRECT".equals(a.getVerdict())).count();
        int correctRate7 = attempts7 == 0 ? 0 : Math.round((correct7 * 100f) / attempts7);

        String topMisconception = last7.stream()
                .map(LearningAttempt::getMisconception)
                .filter(m -> m != null && !m.isBlank())
                .collect(Collectors.groupingBy(m -> m, Collectors.counting()))
                .entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);

        String weakestSkill = categoryStatRepository.findByPlayerId(player.getId()).stream()
                .min(Comparator.comparingDouble(LearningCategoryStat::getConfidence))
                .map(LearningCategoryStat::getCategory)
                .orElse(null);

        return new ClassroomDto.MemberStat(
                player.getId(),
                player.getUsername(),
                member.getRole(),
                player.getLevel(),
                player.getTotalXp(),
                player.getCurrentStreak(),
                attempts7,
                correctRate7,
                topMisconception,
                weakestSkill,
                member.getJoinedAt()
        );
    }

    private List<ClassroomDto.MisconceptionCount> aggregateMisconceptions(Collection<UUID> studentIds, Instant since) {
        if (studentIds.isEmpty()) return List.of();
        Map<String, Integer> counts = new HashMap<>();
        for (UUID id : studentIds) {
            for (LearningAttempt attempt : attemptRepository.findTop300ByPlayerIdOrderByCreatedAtDesc(id)) {
                if (!attempt.getCreatedAt().isAfter(since)) continue;
                String m = attempt.getMisconception();
                if (m == null || m.isBlank()) continue;
                counts.merge(m, 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(6)
                .map(entry -> new ClassroomDto.MisconceptionCount(entry.getKey(), entry.getValue()))
                .toList();
    }

    private List<ClassroomDto.SkillCount> aggregateWeakSkills(Collection<UUID> studentIds) {
        if (studentIds.isEmpty()) return List.of();
        Map<String, int[]> agg = new HashMap<>(); // category -> [attempts, weightedConfidenceX1000]
        for (UUID id : studentIds) {
            for (LearningCategoryStat stat : categoryStatRepository.findByPlayerId(id)) {
                int[] cell = agg.computeIfAbsent(stat.getCategory(), k -> new int[]{0, 0});
                cell[0] += stat.getAttempts();
                cell[1] += (int) Math.round(stat.getConfidence() * stat.getAttempts() * 1000);
            }
        }
        return agg.entrySet().stream()
                .filter(entry -> entry.getValue()[0] > 0)
                .sorted(Comparator.comparingDouble(entry ->
                        (entry.getValue()[1] / 1000.0) / Math.max(1, entry.getValue()[0])))
                .limit(6)
                .map(entry -> {
                    int attempts = entry.getValue()[0];
                    double avgConfidence = (entry.getValue()[1] / 1000.0) / Math.max(1, attempts);
                    return new ClassroomDto.SkillCount(entry.getKey(), attempts, Math.round(avgConfidence * 100.0) / 100.0);
                })
                .toList();
    }

    private Map<UUID, Integer> countMembersByClassroom(List<UUID> classroomIds) {
        Map<UUID, Integer> counts = new HashMap<>();
        for (UUID id : classroomIds) {
            counts.put(id, memberRepository.findByClassroomId(id).size());
        }
        return counts;
    }

    private ClassroomDto.ClassroomResponse toResponse(Classroom classroom, int memberCount, ClassroomMember.Role role) {
        return new ClassroomDto.ClassroomResponse(
                classroom.getId(),
                classroom.getName(),
                classroom.getOwnerPlayerId(),
                classroom.getJoinCode(),
                memberCount,
                role,
                classroom.getCreatedAt()
        );
    }

    private String generateUniqueJoinCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            String code = randomCode();
            if (classroomRepository.findByJoinCode(code).isEmpty()) {
                return code;
            }
        }
        throw new IllegalStateException("Could not generate unique join code");
    }

    private String randomCode() {
        StringBuilder sb = new StringBuilder(JOIN_CODE_LENGTH);
        for (int i = 0; i < JOIN_CODE_LENGTH; i++) {
            sb.append(JOIN_CODE_ALPHABET.charAt(RANDOM.nextInt(JOIN_CODE_ALPHABET.length())));
        }
        return sb.toString();
    }
}

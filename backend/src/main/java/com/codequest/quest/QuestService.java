package com.codequest.quest;

import com.codequest.challenge.PlayerChallenge;
import com.codequest.challenge.PlayerChallengeRepository;
import com.codequest.player.PlayerService;
import com.codequest.progression.PlayerProgressNodeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class QuestService {

    private final PlayerService playerService;
    private final PlayerChallengeRepository playerChallengeRepository;
    private final PlayerQuestClaimRepository playerQuestClaimRepository;
    private final PlayerProgressNodeRepository playerProgressNodeRepository;

    private static final int PRACTICE_TARGET = 5;
    private static final int PRACTICE_REWARD = 120;
    private static final int BUG_HUNTER_TARGET = 2;
    private static final int BUG_HUNTER_REWARD = 180;
    private static final int LESSON_PATH_TARGET = 2;
    private static final int LESSON_PATH_REWARD = 140;

    @Transactional
    public QuestDto.QuestBoardResponse getBoard(UUID playerId) {
        playerService.findById(playerId);
        LocalDate today = LocalDate.now();
        return buildBoard(playerId, today);
    }

    @Transactional
    public QuestDto.QuestBoardResponse claim(UUID playerId, QuestType questType) {
        playerService.findById(playerId);
        LocalDate today = LocalDate.now();

        QuestDefinition quest = buildDefinitions(playerId, today).get(questType);
        if (quest == null) {
            throw new IllegalArgumentException("Unknown quest type");
        }
        if (!quest.completed()) {
            throw new IllegalArgumentException("Quest is not completed yet");
        }

        boolean alreadyClaimed = playerQuestClaimRepository
                .findByPlayerIdAndQuestDateAndQuestType(playerId, today, questType)
                .isPresent();
        if (alreadyClaimed) {
            throw new IllegalArgumentException("Quest reward already claimed");
        }

        playerQuestClaimRepository.save(PlayerQuestClaim.claim(playerId, today, questType, quest.rewardXp()));
        playerService.awardXp(playerId, quest.rewardXp());

        return buildBoard(playerId, today);
    }

    private QuestDto.QuestBoardResponse buildBoard(UUID playerId, LocalDate date) {
        Map<QuestType, QuestDefinition> definitions = buildDefinitions(playerId, date);
        Set<QuestType> claimedTypes = playerQuestClaimRepository.findByPlayerIdAndQuestDate(playerId, date)
                .stream()
                .map(PlayerQuestClaim::getQuestType)
                .collect(Collectors.toSet());

        List<QuestDto.QuestItemResponse> quests = List.of(
                toItem(definitions.get(QuestType.DAILY_PRACTICE), claimedTypes),
                toItem(definitions.get(QuestType.BUG_HUNTER), claimedTypes),
                toItem(definitions.get(QuestType.LESSON_PATH), claimedTypes)
        );

        return new QuestDto.QuestBoardResponse(playerId, date.toString(), quests);
    }

    private QuestDto.QuestItemResponse toItem(QuestDefinition definition, Set<QuestType> claimedTypes) {
        boolean claimed = claimedTypes.contains(definition.type());
        return new QuestDto.QuestItemResponse(
                definition.type(),
                definition.title(),
                definition.description(),
                definition.progress(),
                definition.target(),
                definition.rewardXp(),
                definition.completed(),
                claimed
        );
    }

    private Map<QuestType, QuestDefinition> buildDefinitions(UUID playerId, LocalDate date) {
        Instant dayStart = date.atStartOfDay(ZoneId.systemDefault()).toInstant();

        int attemptsToday = (int) playerChallengeRepository.countByPlayerIdAndStartedAtAfter(playerId, dayStart);
        int correctToday = (int) playerChallengeRepository.countByPlayerIdAndStatusAndStartedAtAfter(
                playerId, PlayerChallenge.AttemptStatus.COMPLETED, dayStart);

        int lessonsToday = (int) playerProgressNodeRepository.countByPlayerIdAndCompletedAtAfter(playerId, dayStart);

        Map<QuestType, QuestDefinition> map = new EnumMap<>(QuestType.class);
        map.put(QuestType.DAILY_PRACTICE, new QuestDefinition(
                QuestType.DAILY_PRACTICE,
                "Daily practice",
                "Submit 5 challenge attempts today",
                attemptsToday,
                PRACTICE_TARGET,
                PRACTICE_REWARD
        ));
        map.put(QuestType.BUG_HUNTER, new QuestDefinition(
                QuestType.BUG_HUNTER,
                "Bug hunter",
                "Solve 2 challenges correctly today",
                correctToday,
                BUG_HUNTER_TARGET,
                BUG_HUNTER_REWARD
        ));
        map.put(QuestType.LESSON_PATH, new QuestDefinition(
                QuestType.LESSON_PATH,
                "Lesson path",
                "Complete 2 lessons today",
                lessonsToday,
                LESSON_PATH_TARGET,
                LESSON_PATH_REWARD
        ));

        return map;
    }

    private record QuestDefinition(
            QuestType type,
            String title,
            String description,
            int progress,
            int target,
            int rewardXp
    ) {
        private boolean completed() {
            return progress >= target;
        }
    }
}




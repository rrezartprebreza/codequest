package com.codequest.progression;

import com.codequest.challenge.PracticeMode;
import com.codequest.player.PlayerLevel;
import com.codequest.player.PlayerService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ProgressionService {

    private final ProgressionNodeRepository progressionNodeRepository;
    private final PlayerProgressNodeRepository playerProgressNodeRepository;
    private final PlayerService playerService;

    @Transactional
    public ProgressionDto.ProgressionResponse getProgression(UUID playerId) {
        playerService.findById(playerId);
        List<ProgressionNode> nodes = ensureSeededNodes();
        List<PlayerProgressNode> progress = ensurePlayerProgress(playerId, nodes);
        return toResponse(playerId, nodes, progress);
    }

    @Transactional
    public ProgressionDto.ProgressionResponse completeActiveNode(UUID playerId, int stars) {
        playerService.findById(playerId);
        List<ProgressionNode> nodes = ensureSeededNodes();
        List<PlayerProgressNode> progress = ensurePlayerProgress(playerId, nodes);

        Map<UUID, PlayerProgressNode> progressByNodeId = indexByNodeId(progress);
        ProgressionNode activeNode = findActiveNode(nodes, progressByNodeId);
        if (activeNode == null) {
            throw new IllegalArgumentException("No active lesson available to complete");
        }

        PlayerProgressNode activeProgress = progressByNodeId.get(activeNode.getId());
        activeProgress.markCompleted(stars);

        ProgressionNode nextNode = nodes.stream()
                .filter(node -> node.getOrderIndex() > activeNode.getOrderIndex())
                .findFirst()
                .orElse(null);

        if (nextNode != null) {
            PlayerProgressNode nextProgress = progressByNodeId.get(nextNode.getId());
            if (nextProgress != null && nextProgress.getStatus() == ProgressStatus.LOCKED) {
                nextProgress.markActive();
            }
        }

        playerProgressNodeRepository.saveAll(progressByNodeId.values());
        return toResponse(playerId, nodes, List.copyOf(progressByNodeId.values()));
    }

    private List<ProgressionNode> ensureSeededNodes() {
        List<ProgressionNode> existing = progressionNodeRepository.findAllByOrderByOrderIndexAsc();
        List<SeedNode> defaults = List.of(
                new SeedNode("Variables and Types", "variables", PlayerLevel.BEGINNER, PracticeMode.BUG_HUNT, "Recognize wrong assignments, types, and default values before they cascade into larger bugs.", 100, 1),
                new SeedNode("Conditionals and Branching", "if statements", PlayerLevel.BEGINNER, PracticeMode.OUTPUT_TRACING, "Translate each branch into plain English and test one true path plus one false path.", 120, 2),
                new SeedNode("Loops and Iteration", "loops", PlayerLevel.BEGINNER, PracticeMode.OUTPUT_TRACING, "Trace loop counters and stop conditions so off-by-one bugs become visible.", 140, 3),
                new SeedNode("Functions and Scope", "functions", PlayerLevel.INTERMEDIATE, PracticeMode.TEST_FIRST, "Check inputs, outputs, and return behavior before changing implementation details.", 170, 4),
                new SeedNode("Collections and Arrays", "arrays", PlayerLevel.INTERMEDIATE, PracticeMode.OUTPUT_TRACING, "Use tiny inputs to reason about indexes, ordering, and collection boundaries.", 200, 5),
                new SeedNode("Strings and Parsing", "strings", PlayerLevel.INTERMEDIATE, PracticeMode.EDGE_CASE_RESCUE, "Harden code against empty strings, trimming issues, and case-sensitive mismatches.", 210, 6),
                new SeedNode("Null Safety and Guards", "null handling", PlayerLevel.INTERMEDIATE, PracticeMode.EDGE_CASE_RESCUE, "Add the missing guard without hiding real failures or changing unrelated paths.", 220, 7),
                new SeedNode("Async and Ordering", "async", PlayerLevel.SENIOR, PracticeMode.EDGE_CASE_RESCUE, "Separate promise flow from resolved data and reason about execution order.", 260, 8),
                new SeedNode("Tests and Behavior", "tests", PlayerLevel.SENIOR, PracticeMode.TEST_FIRST, "Use expected behavior to drive the fix instead of guessing at the implementation.", 280, 9),
                new SeedNode("Debugging Real Logic Bugs", "debugging", PlayerLevel.SENIOR, PracticeMode.BUG_HUNT, "Combine tracing, edge-case thinking, and tests to isolate production-style bugs.", 320, 10)
        );

        if (existing.isEmpty()) {
            return defaults.stream()
                    .map(seed -> progressionNodeRepository.save(seed.toEntity()))
                    .toList();
        }

        Map<Integer, ProgressionNode> byOrder = new HashMap<>();
        for (ProgressionNode node : existing) {
            byOrder.put(node.getOrderIndex(), node);
        }

        for (SeedNode seed : defaults) {
            if (!byOrder.containsKey(seed.orderIndex())) {
                ProgressionNode saved = progressionNodeRepository.save(seed.toEntity());
                byOrder.put(saved.getOrderIndex(), saved);
            }
        }

        return progressionNodeRepository.findAllByOrderByOrderIndexAsc();
    }

    private List<PlayerProgressNode> ensurePlayerProgress(UUID playerId, List<ProgressionNode> nodes) {
        List<PlayerProgressNode> existing = playerProgressNodeRepository.findByPlayerId(playerId);
        if (existing.size() == nodes.size() && !existing.isEmpty()) {
            return existing;
        }

        if (existing.isEmpty()) {
            List<PlayerProgressNode> created = nodes.stream()
                    .map(node -> PlayerProgressNode.create(
                            playerId,
                            node.getId(),
                            node.getOrderIndex() == 1 ? ProgressStatus.ACTIVE : ProgressStatus.LOCKED
                    ))
                    .toList();
            return playerProgressNodeRepository.saveAll(created);
        }

        Map<UUID, PlayerProgressNode> byNodeId = indexByNodeId(existing);
        boolean changed = false;
        for (ProgressionNode node : nodes) {
            if (!byNodeId.containsKey(node.getId())) {
                PlayerProgressNode created = PlayerProgressNode.create(playerId, node.getId(), ProgressStatus.LOCKED);
                byNodeId.put(node.getId(), created);
                changed = true;
            }
        }

        if (byNodeId.values().stream().noneMatch(progress -> progress.getStatus() == ProgressStatus.ACTIVE)
                && byNodeId.values().stream().anyMatch(progress -> progress.getStatus() != ProgressStatus.COMPLETED)) {
            nodes.stream()
                    .filter(node -> byNodeId.get(node.getId()).getStatus() == ProgressStatus.LOCKED)
                    .findFirst()
                    .ifPresent(node -> {
                        byNodeId.get(node.getId()).markActive();
                    });
            changed = true;
        }

        if (changed) {
            return playerProgressNodeRepository.saveAll(byNodeId.values().stream().toList());
        }
        return existing;
    }

    private ProgressionDto.ProgressionResponse toResponse(UUID playerId, List<ProgressionNode> nodes, List<PlayerProgressNode> progress) {
        Map<UUID, PlayerProgressNode> progressByNodeId = indexByNodeId(progress);
        List<ProgressionDto.ProgressionNodeResponse> nodeResponses = nodes.stream()
                .map(node -> {
                    ProgressStatus status = progressByNodeId.getOrDefault(node.getId(), PlayerProgressNode.create(playerId, node.getId(), ProgressStatus.LOCKED)).getStatus();
                    int starsEarned = progressByNodeId.getOrDefault(node.getId(), PlayerProgressNode.create(playerId, node.getId(), ProgressStatus.LOCKED)).getStarsEarned();
                    return new ProgressionDto.ProgressionNodeResponse(
                            node.getId(),
                            node.getTitle(),
                            node.getTopic(),
                            node.getDifficulty(),
                            node.getPracticeMode(),
                            node.getLearningObjective(),
                            node.getXpReward(),
                            node.getOrderIndex(),
                            status,
                            starsEarned
                    );
                })
                .toList();

        UUID activeNodeId = nodeResponses.stream()
                .filter(node -> node.status() == ProgressStatus.ACTIVE)
                .map(ProgressionDto.ProgressionNodeResponse::nodeId)
                .findFirst()
                .orElse(null);

        int completedCount = (int) nodeResponses.stream()
                .filter(node -> node.status() == ProgressStatus.COMPLETED)
                .count();

        return new ProgressionDto.ProgressionResponse(
                playerId,
                activeNodeId,
                completedCount,
                nodeResponses.size(),
                nodeResponses
        );
    }

    private Map<UUID, PlayerProgressNode> indexByNodeId(List<PlayerProgressNode> progress) {
        Map<UUID, PlayerProgressNode> byNodeId = new HashMap<>();
        for (PlayerProgressNode item : progress) {
            byNodeId.put(item.getNodeId(), item);
        }
        return byNodeId;
    }

    private ProgressionNode findActiveNode(List<ProgressionNode> nodes, Map<UUID, PlayerProgressNode> progressByNodeId) {
        return nodes.stream()
                .filter(node -> {
                    PlayerProgressNode progress = progressByNodeId.get(node.getId());
                    return progress != null && progress.getStatus() == ProgressStatus.ACTIVE;
                })
                .findFirst()
                .orElse(null);
    }

    private record SeedNode(
            String title,
            String topic,
            PlayerLevel difficulty,
            PracticeMode practiceMode,
            String learningObjective,
            int xpReward,
            int orderIndex
    ) {
        private ProgressionNode toEntity() {
            return ProgressionNode.create(title, topic, difficulty, practiceMode, learningObjective, xpReward, orderIndex);
        }
    }
}


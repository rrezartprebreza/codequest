package com.codequest.quest;

import java.util.List;
import java.util.UUID;

public class QuestDto {

    public record QuestItemResponse(
            QuestType type,
            String title,
            String description,
            int progress,
            int target,
            int rewardXp,
            boolean completed,
            boolean claimed
    ) {}

    public record QuestBoardResponse(
            UUID playerId,
            String questDate,
            List<QuestItemResponse> quests
    ) {}
}

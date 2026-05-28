package com.codequest.progression;

import com.codequest.challenge.PracticeMode;
import com.codequest.player.PlayerLevel;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.util.List;
import java.util.UUID;

public class ProgressionDto {

    public record CompleteNodeRequest(
            @Min(1) @Max(3) Integer stars
    ) {}

    public record ProgressionNodeResponse(
            UUID nodeId,
            String title,
            String topic,
            PlayerLevel difficulty,
            PracticeMode practiceMode,
            String learningObjective,
            int xpReward,
            int orderIndex,
            ProgressStatus status,
            int starsEarned
    ) {}

    public record ProgressionResponse(
            UUID playerId,
            UUID activeNodeId,
            int completedCount,
            int totalCount,
            List<ProgressionNodeResponse> nodes
    ) {}
}

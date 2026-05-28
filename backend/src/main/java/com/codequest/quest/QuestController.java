package com.codequest.quest;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/quests")
@RequiredArgsConstructor
public class QuestController {

    private final QuestService questService;

    @GetMapping("/{playerId}")
    public ApiResponse<QuestDto.QuestBoardResponse> getBoard(@PathVariable UUID playerId) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(questService.getBoard(playerId));
    }

    @PostMapping("/{playerId}/claim/{questType}")
    public ApiResponse<QuestDto.QuestBoardResponse> claim(
            @PathVariable UUID playerId,
            @PathVariable QuestType questType) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(questService.claim(playerId, questType));
    }
}

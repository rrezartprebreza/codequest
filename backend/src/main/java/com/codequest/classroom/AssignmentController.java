package com.codequest.classroom;

import com.codequest.auth.AuthUtils;
import com.codequest.common.dto.ApiResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/assignments")
@RequiredArgsConstructor
public class AssignmentController {

    private final AssignmentService assignmentService;

    /** Create an assignment in a classroom. teacherId in the body must be a TEACHER member AND match the JWT. */
    @PostMapping("/classroom/{classroomId}")
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<AssignmentDto.AssignmentResponse> create(
            @PathVariable UUID classroomId,
            @Valid @RequestBody AssignmentDto.CreateRequest request) {
        AuthUtils.requireSelfOrThrow(request.teacherId());
        return ApiResponse.ok(assignmentService.create(classroomId, request));
    }

    /** List all assignments in a classroom (teacher view — no per-student progress). */
    @GetMapping("/classroom/{classroomId}")
    public ApiResponse<List<AssignmentDto.AssignmentResponse>> listForClassroom(
            @PathVariable UUID classroomId) {
        return ApiResponse.ok(assignmentService.listForClassroom(classroomId));
    }

    /** Student view: assignments across all my classrooms, with my progress + overdue flags. */
    @GetMapping("/player/{playerId}")
    public ApiResponse<List<AssignmentDto.AssignmentResponse>> listForPlayer(
            @PathVariable UUID playerId) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(assignmentService.listForPlayer(playerId));
    }
}

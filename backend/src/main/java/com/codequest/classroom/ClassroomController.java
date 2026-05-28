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
@RequestMapping("/api/v1/classrooms")
@RequiredArgsConstructor
public class ClassroomController {

    private final ClassroomService classroomService;

    /** Create a classroom. The creator automatically becomes a TEACHER. */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ApiResponse<ClassroomDto.ClassroomResponse> create(
            @Valid @RequestBody ClassroomDto.CreateRequest request) {
        AuthUtils.requireSelfOrThrow(request.ownerPlayerId());
        return ApiResponse.ok(classroomService.create(request));
    }

    /** Join an existing classroom by short join code. */
    @PostMapping("/join")
    public ApiResponse<ClassroomDto.ClassroomResponse> join(
            @Valid @RequestBody ClassroomDto.JoinRequest request) {
        AuthUtils.requireSelfOrThrow(request.playerId());
        return ApiResponse.ok(classroomService.join(request));
    }

    /** List all classrooms a player belongs to. */
    @GetMapping("/player/{playerId}")
    public ApiResponse<List<ClassroomDto.ClassroomResponse>> listForPlayer(
            @PathVariable UUID playerId) {
        AuthUtils.requireSelfOrThrow(playerId);
        return ApiResponse.ok(classroomService.listForPlayer(playerId));
    }

    /**
     * Teacher dashboard: cohort stats + per-student stats. The requester is taken
     * from the JWT — clients can no longer pass an arbitrary teacherId. Service
     * still verifies the player is a TEACHER member of the classroom.
     */
    @GetMapping("/{classroomId}/dashboard")
    public ApiResponse<ClassroomDto.DashboardResponse> dashboard(
            @PathVariable UUID classroomId) {
        UUID teacherId = AuthUtils.requireCurrentPlayerId();
        return ApiResponse.ok(classroomService.getDashboard(classroomId, teacherId));
    }

    /**
     * Per-student deep-dive for the lecturer: recent attempts + tutor transcripts
     * for the student's last few challenges. Requester taken from the JWT and
     * must be a TEACHER of this classroom.
     */
    @GetMapping("/{classroomId}/students/{studentId}/deep-dive")
    public ApiResponse<ClassroomDto.StudentDeepDive> studentDeepDive(
            @PathVariable UUID classroomId,
            @PathVariable UUID studentId) {
        UUID requesterId = AuthUtils.requireCurrentPlayerId();
        return ApiResponse.ok(classroomService.getStudentDeepDive(classroomId, requesterId, studentId));
    }
}

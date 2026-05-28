package com.codequest.tutor;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import reactor.core.publisher.Flux;

@RestController
@RequestMapping("/api/v1/tutor")
@RequiredArgsConstructor
public class TutorController {

    private final TutorService tutorService;

    /**
     * SSE streaming chat endpoint.
     * Client connects and receives streamed tokens in real-time.
     */
    @PostMapping(value = "/chat/{sessionId}", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    public Flux<String> chat(
            @PathVariable String sessionId,
            @Valid @RequestBody ChatRequest request) {
        return tutorService.chat(sessionId, request.message());
    }

    public record ChatRequest(@NotBlank String message) {}
}

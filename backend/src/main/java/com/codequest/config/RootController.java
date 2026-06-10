package com.codequest.config;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@RestController
public class RootController {

    @GetMapping({"/", "/health"})
    public Map<String, Object> health() {
        return Map.of(
                "success", true,
                "service", "codequest-backend",
                "status", "ok",
                "timestamp", Instant.now().toString()
        );
    }
}

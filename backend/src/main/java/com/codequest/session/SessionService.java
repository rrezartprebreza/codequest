package com.codequest.session;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SessionService {

    private final StringRedisTemplate redisTemplate;
    private final ObjectMapper objectMapper;

    @Value("${codequest.session.ttl-minutes:120}")
    private long sessionTtlMinutes;

    private static final String KEY_PREFIX = "codequest:session:";

    public GameSession getOrCreate(String sessionId, UUID playerId,
                                    String programmingLanguage, String playerLevel,
                                    String humanLanguage) {
        String key = KEY_PREFIX + sessionId;
        String json = redisTemplate.opsForValue().get(key);

        if (json != null) {
            try {
                return objectMapper.readValue(json, GameSession.class);
            } catch (Exception e) {
                log.warn("Corrupt session {}, creating new", sessionId);
            }
        }

        GameSession session = GameSession.builder()
                .sessionId(sessionId)
                .playerId(playerId)
                .programmingLanguage(programmingLanguage)
                .playerLevel(playerLevel)
                .humanLanguage(humanLanguage)
                .build();

        save(session);
        return session;
    }

    public GameSession getOrCreate(String sessionId) {
        String key = KEY_PREFIX + sessionId;
        String json = redisTemplate.opsForValue().get(key);
        if (json != null) {
            try {
                return objectMapper.readValue(json, GameSession.class);
            } catch (Exception e) {
                log.warn("Corrupt session {}", sessionId);
            }
        }
        // Return a minimal default session
        GameSession session = GameSession.builder()
                .sessionId(sessionId)
                .programmingLanguage("General")
                .playerLevel("BEGINNER")
                .humanLanguage("en")
                .build();
        save(session);
        return session;
    }

    public void save(GameSession session) {
        try {
            String key = KEY_PREFIX + session.getSessionId();
            String json = objectMapper.writeValueAsString(session);
            redisTemplate.opsForValue().set(key, json, Duration.ofMinutes(sessionTtlMinutes));
        } catch (Exception e) {
            log.error("Failed to save session {}", session.getSessionId(), e);
        }
    }

    public void delete(String sessionId) {
        redisTemplate.delete(KEY_PREFIX + sessionId);
    }
}

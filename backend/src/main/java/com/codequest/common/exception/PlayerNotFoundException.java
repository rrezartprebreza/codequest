package com.codequest.common.exception;

import java.util.UUID;

public class PlayerNotFoundException extends RuntimeException {
    public PlayerNotFoundException(UUID id) {
        super("Player not found: " + id);
    }
    public PlayerNotFoundException(String username) {
        super("Player not found: " + username);
    }
}

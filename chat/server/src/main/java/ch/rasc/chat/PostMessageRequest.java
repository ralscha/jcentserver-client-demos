package ch.rasc.chat;

public record PostMessageRequest(String room, String username, String message) {
}

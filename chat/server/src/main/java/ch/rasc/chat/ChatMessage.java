package ch.rasc.chat;

public record ChatMessage(String id, MessageType type, String user, String message, long sendDate) {
}

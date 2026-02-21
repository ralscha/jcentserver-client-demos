package ch.rasc.chat;

public record ChatMessage(MessageType type, String user, String message, long sendDate) {
}

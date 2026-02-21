package ch.rasc.datachannel;

import java.util.Map;

public record IceMessage(String receiver, String id, Map<String, Object> candidate) {
}

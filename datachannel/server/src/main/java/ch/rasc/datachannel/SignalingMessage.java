package ch.rasc.datachannel;

import java.util.Map;

public record SignalingMessage(String receiver, String id, Map<String, Object> localDescription) {
}

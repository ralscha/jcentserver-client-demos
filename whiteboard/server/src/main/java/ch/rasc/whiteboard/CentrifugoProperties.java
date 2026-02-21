package ch.rasc.whiteboard;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "centrifugo")
public record CentrifugoProperties(String apiBaseUrl, String apiKey, String hmacSecret) {
}

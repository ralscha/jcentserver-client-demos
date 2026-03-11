package ch.rasc.presencedashboard;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "centrifugo")
public record CentrifugoProperties(String hmacSecret) {
}
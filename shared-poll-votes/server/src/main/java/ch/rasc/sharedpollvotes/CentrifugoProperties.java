package ch.rasc.sharedpollvotes;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "centrifugo")
public record CentrifugoProperties(String apiBaseUrl, String apiKey, String hmacSecret, String sharedPollSecret) {
}

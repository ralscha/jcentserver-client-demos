package ch.rasc.sharedpollvotes;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "cors")
public record CorsProperties(String[] allowedOrigins, String[] allowedMethods, String[] allowedHeaders,
		boolean allowCredentials, long maxAge) {
}

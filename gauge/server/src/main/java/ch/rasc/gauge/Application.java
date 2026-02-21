package ch.rasc.gauge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@SpringBootApplication
@EnableScheduling
@ConfigurationPropertiesScan("ch.rasc.gauge")
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	@Bean
	WebMvcConfigurer corsConfigurer(CorsProperties corsProperties) {

		return new WebMvcConfigurer() {
			@Override
			public void addCorsMappings(CorsRegistry registry) {
				registry.addMapping("/**")
					.allowedOrigins(corsProperties.allowedOrigins())
					.allowedMethods(corsProperties.allowedMethods())
					.allowedHeaders(corsProperties.allowedHeaders())
					.allowCredentials(corsProperties.allowCredentials())
					.maxAge(corsProperties.maxAge());
			}
		};
	}

	@Bean
	CentrifugoServerApiClient centrifugoConfig(CentrifugoProperties centrifugoProperties) {
		return CentrifugoServerApiClient
			.create(cfg -> cfg.apiKey(centrifugoProperties.apiKey())
				.baseUrl(centrifugoProperties.apiBaseUrl()));
	}

}

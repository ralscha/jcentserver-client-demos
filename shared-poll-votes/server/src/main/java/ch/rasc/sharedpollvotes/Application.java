package ch.rasc.sharedpollvotes;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@SpringBootApplication
@ConfigurationPropertiesScan("ch.rasc.sharedpollvotes")
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
	RestClient centrifugoRestClient(CentrifugoProperties centrifugoProperties) {
		return RestClient.builder()
			.baseUrl(centrifugoProperties.apiBaseUrl())
			.defaultHeader("Authorization", "apikey " + centrifugoProperties.apiKey())
			.build();
	}

}

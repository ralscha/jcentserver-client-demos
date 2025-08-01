package ch.rasc.demo.snake;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;
import org.springframework.context.annotation.Bean;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@SpringBootApplication
@ConfigurationPropertiesScan("ch.rasc.demo.snake")
public class Application {

	public static void main(String[] args) {
		SpringApplication.run(Application.class, args);
	}

	@Bean
	CentrifugoServerApiClient centrifugoConfig(CentrifugoProperties centrifugoProperties) {
		return CentrifugoServerApiClient
			.create(cfg -> cfg.apiKey(centrifugoProperties.apiKey()).baseUrl(centrifugoProperties.apiBaseUrl()));
	}

}

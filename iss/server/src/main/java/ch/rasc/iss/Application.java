/*
 * Copyright the original author or authors.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package ch.rasc.iss;

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
@ConfigurationPropertiesScan("ch.rasc.iss")
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
			.create(cfg -> cfg.apiKey(centrifugoProperties.apiKey()).baseUrl(centrifugoProperties.apiBaseUrl()));
	}

}

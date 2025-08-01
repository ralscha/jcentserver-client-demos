package ch.rasc.iss;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@RestController
public class CentrifugoTokenController {

	private final Key centrifugoHmacShaKey;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public CentrifugoTokenController(CentrifugoProperties centrifugoConfig,
			CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoHmacShaKey = Keys.hmacShaKeyFor(centrifugoConfig.hmacSecret().getBytes(StandardCharsets.UTF_8));
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@GetMapping("/centrifugo-token")
	@ResponseBody
	public String token() {
		String userId = UUID.randomUUID().toString();
		System.out.println("Generated userId: " + userId);
		return Jwts.builder()
			.subject(userId)
			// auto subscribe to channel "iss"
			/* claim("channels", List.of("iss")). */
			.signWith(this.centrifugoHmacShaKey)
			.compact();
	}

	record UserId(String userId) {
	}

	@PostMapping("/subscribe")
	public void subscribe(@RequestBody UserId userId) {
		var response = this.centrifugoServerApiClient.connection()
			.subscribe(b -> b.channel("iss").user(userId.userId()));
		System.out.println(response);
	}

}

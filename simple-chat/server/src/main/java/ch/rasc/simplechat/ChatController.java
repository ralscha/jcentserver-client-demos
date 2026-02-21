package ch.rasc.simplechat;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@RestController
public class ChatController {

	private final Key centrifugoHmacShaKey;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public ChatController(CentrifugoProperties centrifugoConfig,
			CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoHmacShaKey = Keys
			.hmacShaKeyFor(centrifugoConfig.hmacSecret().getBytes(StandardCharsets.UTF_8));
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@GetMapping("/centrifugo-token")
	@ResponseBody
	public String token() {
		String userId = UUID.randomUUID().toString();
		return Jwts.builder().subject(userId).signWith(this.centrifugoHmacShaKey).compact();
	}

	record ChatMessage(String id, String text, String sentAt) {
	}

	@PostMapping("/chat")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void chat(@RequestBody ChatMessage message) {
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(message));
	}

}

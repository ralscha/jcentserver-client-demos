package ch.rasc.simplechat;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class ChatController {

	private final Algorithm algorithmHS;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public ChatController(CentrifugoProperties centrifugoConfig, CentrifugoServerApiClient centrifugoServerApiClient) {
		this.algorithmHS = Algorithm.HMAC512(centrifugoConfig.hmacSecret());
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@GetMapping("/centrifugo-token")
	@ResponseBody
	public String token() {
		String userId = UUID.randomUUID().toString();
		return JWT.create().withSubject(userId).sign(this.algorithmHS);
	}

	record ChatMessage(String id, String text, String sentAt) {
	}

	@PostMapping("/chat")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void chat(@RequestBody ChatMessage message) {
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(message));
	}

}

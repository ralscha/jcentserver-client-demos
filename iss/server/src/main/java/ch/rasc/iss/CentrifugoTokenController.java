package ch.rasc.iss;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class CentrifugoTokenController {

	private final Algorithm algorithmHS;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public CentrifugoTokenController(CentrifugoProperties centrifugoConfig,
			CentrifugoServerApiClient centrifugoServerApiClient) {
		this.algorithmHS = Algorithm.HMAC512(centrifugoConfig.hmacSecret());
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@GetMapping("/centrifugo-token")
	@ResponseBody
	public String token() {
		String userId = UUID.randomUUID().toString();
		System.out.println("Generated userId: " + userId);
		return JWT.create()
			.withSubject(userId)
			// auto subscribe to channel "iss"
			/* .withClaim("channels", List.of("iss")) */
			.sign(this.algorithmHS);
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

package ch.rasc.iss;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
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
	public TokenResponse token() {
		String userId = UUID.randomUUID().toString();
		return new TokenResponse(userId, JWT.create().withSubject(userId).sign(this.algorithmHS));
	}

	record TokenResponse(String userId, String token) {
	}

	@PostMapping("/subscribe")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void subscribe(@RequestBody UserId userId) {
		this.centrifugoServerApiClient.connection().subscribe(b -> b.channel("iss").user(userId.userId()));
	}

	record UserId(String userId) {
	}

}

package ch.rasc.presencedashboard;

import java.util.Map;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class PresenceController {

	private final Algorithm algorithmHS;

	public PresenceController(CentrifugoProperties centrifugoProperties) {
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	@PostMapping("/centrifugo-token")
	public Map<String, String> token(@RequestBody SigninRequest request) {
		String token = JWT.create()
			.withSubject(request.username())
			.withClaim("info", Map.of("name", request.username(), "role", request.role(), "desk", request.desk()))
			.sign(this.algorithmHS);
		return Map.of("token", token);
	}

	public record SigninRequest(String username, String role, String desk) {
	}

}
package ch.rasc.presencedashboard;

import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

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
		String username = requireText(request.username(), "username", 40);
		String role = requireText(request.role(), "role", 40);
		String desk = requireText(request.desk(), "desk", 40);
		String token = JWT.create()
			.withSubject(username)
			.withClaim("info", Map.of("name", username, "role", role, "desk", desk))
			.sign(this.algorithmHS);
		return Map.of("token", token);
	}

	private static String requireText(String value, String field, int maxLength) {
		if (value == null || value.isBlank() || value.length() > maxLength) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					field + " must contain between 1 and " + maxLength + " characters");
		}
		return value.trim();
	}

	public record SigninRequest(String username, String role, String desk) {
	}

}

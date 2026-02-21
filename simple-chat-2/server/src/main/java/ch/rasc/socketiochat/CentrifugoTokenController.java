package ch.rasc.socketiochat;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@RestController
public class CentrifugoTokenController {

	private final Key centrifugoHmacShaKey;

	public CentrifugoTokenController(CentrifugoProperties centrifugoConfig) {
		this.centrifugoHmacShaKey = Keys
			.hmacShaKeyFor(centrifugoConfig.hmacSecret().getBytes(StandardCharsets.UTF_8));
	}

	@GetMapping("/centrifugo-token")
	@ResponseBody
	public String token(@RequestParam(required = false) String userId) {
		String subject = (userId != null && !userId.isBlank()) ? userId : UUID.randomUUID().toString();
		return Jwts.builder().subject(subject).signWith(this.centrifugoHmacShaKey).compact();
	}

}

package ch.rasc.datachannel;

import java.nio.charset.StandardCharsets;
import java.security.Key;

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
	public String token(@RequestParam String clientId) {
		// Use clientId as the JWT subject so Centrifugo knows the user identity
		return Jwts.builder().subject(clientId).signWith(this.centrifugoHmacShaKey).compact();
	}

}

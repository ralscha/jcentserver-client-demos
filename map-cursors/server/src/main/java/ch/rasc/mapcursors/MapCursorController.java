package ch.rasc.mapcursors;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class MapCursorController {

	private final Algorithm algorithmHS;

	public MapCursorController(CentrifugoProperties centrifugoProperties) {
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	@GetMapping("/centrifugo-token")
	public String token() {
		return JWT.create().withSubject("cursor-" + UUID.randomUUID()).sign(this.algorithmHS);
	}

}

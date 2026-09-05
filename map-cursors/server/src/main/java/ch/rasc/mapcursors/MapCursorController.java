package ch.rasc.mapcursors;

import java.util.UUID;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class MapCursorController {

	private static final String CHANNEL = "cursors:room";

	private final Algorithm algorithmHS;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public MapCursorController(CentrifugoProperties centrifugoProperties,
			CentrifugoServerApiClient centrifugoServerApiClient) {
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@GetMapping("/centrifugo-token")
	public String token() {
		return JWT.create().withSubject("cursor-" + UUID.randomUUID()).sign(this.algorithmHS);
	}

	@PostMapping("/cursors/clear")
	@ResponseStatus(HttpStatus.NO_CONTENT)
	public void clear() {
		this.centrifugoServerApiClient.map().mapClear(builder -> builder.channel(CHANNEL));
	}

}

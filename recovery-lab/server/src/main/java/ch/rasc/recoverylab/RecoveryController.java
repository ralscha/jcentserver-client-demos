package ch.rasc.recoverylab;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class RecoveryController {

	private final RecoveryEventService recoveryEventService;

	private final Algorithm algorithmHS;

	public RecoveryController(RecoveryEventService recoveryEventService, CentrifugoProperties centrifugoProperties) {
		this.recoveryEventService = recoveryEventService;
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	@GetMapping("/centrifugo-token")
	public String token() {
		return JWT.create().withSubject("recovery-" + UUID.randomUUID()).sign(this.algorithmHS);
	}

	@PostMapping("/burst")
	public void burst(@RequestBody Map<String, Integer> request) {
		this.recoveryEventService.publishBurst(request.getOrDefault("count", 12));
	}

	@PostMapping("/reset")
	public void reset() {
		this.recoveryEventService.reset();
	}

}
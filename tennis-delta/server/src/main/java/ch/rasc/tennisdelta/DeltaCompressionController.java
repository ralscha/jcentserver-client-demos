package ch.rasc.tennisdelta;

import java.util.Map;
import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class DeltaCompressionController {

	private final TennisMatchService tennisMatchService;

	private final Algorithm algorithmHS;

	public DeltaCompressionController(TennisMatchService tennisMatchService,
			CentrifugoProperties centrifugoProperties) {
		this.tennisMatchService = tennisMatchService;
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	@GetMapping("/centrifugo-token")
	public String token() {
		return JWT.create().withSubject("tennis-" + UUID.randomUUID()).sign(this.algorithmHS);
	}

	@GetMapping("/match-state")
	public Map<String, Object> matchState() {
		return this.tennisMatchService.snapshot();
	}

	@PostMapping("/next-point")
	public void nextPoint() {
		this.tennisMatchService.playPointAndPublish();
	}

	@PostMapping("/reset-match")
	public void resetMatch() {
		this.tennisMatchService.resetAndPublish();
	}

	@PostMapping("/autoplay")
	public void autoplay(@RequestBody Map<String, Boolean> request) {
		this.tennisMatchService.setAutoplay(Boolean.TRUE.equals(request.get("enabled")));
	}

}
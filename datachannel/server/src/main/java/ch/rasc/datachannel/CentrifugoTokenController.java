package ch.rasc.datachannel;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class CentrifugoTokenController {

	private final Algorithm algorithmHS;

	public CentrifugoTokenController(CentrifugoProperties centrifugoConfig) {
		this.algorithmHS = Algorithm.HMAC512(centrifugoConfig.hmacSecret());
	}

	@GetMapping("/centrifugo-token")
	@ResponseBody
	public String token(@RequestParam String clientId) {
		// Use clientId as the JWT subject so Centrifugo knows the user identity
		return JWT.create().withSubject(clientId).sign(this.algorithmHS);
	}

}

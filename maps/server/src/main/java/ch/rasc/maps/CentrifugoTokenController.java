package ch.rasc.maps;

import java.util.UUID;

import org.springframework.web.bind.annotation.GetMapping;
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
	public String token() {
		String userId = UUID.randomUUID().toString();
		return JWT.create().withSubject(userId).sign(this.algorithmHS);
	}

}

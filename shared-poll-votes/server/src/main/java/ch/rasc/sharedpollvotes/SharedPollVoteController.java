package ch.rasc.sharedpollvotes;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

@RestController
public class SharedPollVoteController {

	private static final String USER_ID = "votes";

	private final SharedPollVoteService voteService;

	private final Algorithm algorithmHS;

	private final String sharedPollSecret;

	public SharedPollVoteController(SharedPollVoteService voteService, CentrifugoProperties centrifugoProperties) {
		this.voteService = voteService;
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
		this.sharedPollSecret = centrifugoProperties.sharedPollSecret();
	}

	@GetMapping("/centrifugo-token")
	public String token() {
		return JWT.create().withSubject(USER_ID).sign(this.algorithmHS);
	}

	@GetMapping("/posts")
	public List<SharedPollVoteService.VoteItem> posts() {
		return List.copyOf(this.voteService.posts());
	}

	@PostMapping("/vote")
	public SharedPollVoteService.VoteItem vote(@RequestBody KeyRequest request) {
		return this.voteService.vote(request.key());
	}

	@PostMapping("/signature")
	public SignatureResponse signature(@RequestBody KeysRequest request) {
		return new SignatureResponse(request.keys(), sign(request.keys()));
	}

	@PostMapping("/centrifugo/refresh")
	public Map<String, Object> refresh(@RequestBody SharedPollVoteService.RefreshRequest request) {
		return this.voteService.refresh(request);
	}

	private String sign(List<String> keys) {
		try {
			long now = Instant.now().getEpochSecond();
			long exp = now + 60;
			String keysHash = HexFormat.of()
				.formatHex(MessageDigest.getInstance("SHA-256")
					.digest(String.join("\0", keys).getBytes(StandardCharsets.UTF_8)));
			String payload = "%d\0%d\0%s\0%s\0%s".formatted(now, exp, USER_ID, SharedPollVoteService.CHANNEL,
					keysHash);
			Mac mac = Mac.getInstance("HmacSHA256");
			mac.init(new SecretKeySpec(this.sharedPollSecret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
			return "%d:%d:%s".formatted(now, exp,
					HexFormat.of().formatHex(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8))));
		}
		catch (Exception ex) {
			throw new IllegalStateException("Could not sign shared poll keys", ex);
		}
	}

	public record KeyRequest(String key) {
	}

	public record KeysRequest(List<String> keys) {
		public KeysRequest {
			keys = keys == null ? List.of() : keys;
		}
	}

	public record SignatureResponse(List<String> keys, String signature) {
	}

}

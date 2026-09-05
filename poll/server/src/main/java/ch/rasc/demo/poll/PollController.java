package ch.rasc.demo.poll;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentMap;

import org.mapdb.DB;
import org.mapdb.DBMaker;
import org.mapdb.Serializer;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;
import jakarta.annotation.PreDestroy;

@RestController
@CrossOrigin
public class PollController {

	private final DB db;

	private final ConcurrentMap<String, Long> pollMap;

	private static final String[] OPERATING_SYSTEMS = { "Windows", "macOS", "Linux", "Other" };

	private static final Set<String> VALID_OPERATING_SYSTEMS = Set.copyOf(Arrays.asList(OPERATING_SYSTEMS));

	private final Algorithm algorithmHS;

	private final CentrifugoProperties centrifugoProperties;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	PollController(CentrifugoProperties centrifugoProperties, CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoProperties = centrifugoProperties;
		this.centrifugoServerApiClient = centrifugoServerApiClient;

		this.db = DBMaker.fileDB("./counter.db").transactionEnable().make();
		this.pollMap = this.db.hashMap("polls", Serializer.STRING, Serializer.LONG).createOrOpen();

		for (String os : OPERATING_SYSTEMS) {
			this.pollMap.putIfAbsent(os, 0L);
		}

		this.algorithmHS = Algorithm.HMAC512(this.centrifugoProperties.hmacSecret());

	}

	@PreDestroy
	public void close() {
		this.db.close();
	}

	@GetMapping("/poll")
	public String pollData() {
		return pollDataValue();
	}

	private String pollDataValue() {
		StringBuilder sb = new StringBuilder(10);
		for (int i = 0; i < OPERATING_SYSTEMS.length; i++) {
			sb.append(this.pollMap.get(OPERATING_SYSTEMS[i]));
			if (i < OPERATING_SYSTEMS.length - 1) {
				sb.append(',');
			}
		}
		return sb.toString();
	}

	@PostMapping("/poll")
	@ResponseStatus(code = HttpStatus.NO_CONTENT)
	public synchronized void poll(@RequestBody String os) {
		if (!VALID_OPERATING_SYSTEMS.contains(os)) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown operating system");
		}
		this.pollMap.merge(os, 1L, (oldValue, one) -> oldValue + one);
		this.db.commit();
		sendPollData();
	}

	@GetMapping("/token")
	public String token() {
		return JWT.create().withSubject("poll").withClaim("channels", List.of("poll")).sign(this.algorithmHS);
	}

	private void sendPollData() {
		this.centrifugoServerApiClient.publication()
			.publish(p -> p.channel("poll").data(Map.of("result", pollDataValue())));
	}

}

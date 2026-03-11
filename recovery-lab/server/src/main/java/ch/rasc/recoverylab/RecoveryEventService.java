package ch.rasc.recoverylab;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@Service
public class RecoveryEventService {

	private static final String CHANNEL = "recovery:lab";

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final AtomicLong sequence = new AtomicLong();

	public RecoveryEventService(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@Scheduled(fixedRate = 1000)
	public void tick() {
		publish("steady", "Background heartbeat advanced.");
	}

	public void publishBurst(int count) {
		for (int i = 0; i < count; i++) {
			publish("burst", "Burst message " + (i + 1) + " of " + count + ".");
		}
	}

	public void reset() {
		this.sequence.set(0);
		publish("reset", "Sequence reset to zero.");
	}

	private void publish(String source, String message) {
		long seq = this.sequence.incrementAndGet();
		this.centrifugoServerApiClient.publication()
			.publish(builder -> builder.channel(CHANNEL)
				.data(Map.of("seq", seq, "source", source, "message", message, "publishedAt",
						Instant.now().toString())));
	}

}
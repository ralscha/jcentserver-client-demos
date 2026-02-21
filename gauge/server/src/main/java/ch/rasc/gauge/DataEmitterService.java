package ch.rasc.gauge;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@Service
public class DataEmitterService {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final Random random = new Random();

	public DataEmitterService(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@Scheduled(initialDelay = 2_000, fixedRate = 1_000)
	public void sendData() {
		List<Integer> data = new ArrayList<>();
		for (int i = 0; i < 5; i++) {
			data.add(this.random.nextInt(31));
		}
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("gauge").data(data));
	}

}

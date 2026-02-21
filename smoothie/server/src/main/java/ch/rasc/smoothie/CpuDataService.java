package ch.rasc.smoothie;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@Service
public class CpuDataService {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final Random random = new Random();

	public CpuDataService(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@Scheduled(initialDelay = 3_000, fixedDelay = 1_000)
	public void sendData() {
		Map<String, Object> data = new HashMap<>();
		data.put("time", System.currentTimeMillis());
		data.put("host1",
				new double[] { this.random.nextDouble(), this.random.nextDouble(),
						this.random.nextDouble(), this.random.nextDouble() });
		data.put("host2",
				new double[] { this.random.nextDouble(), this.random.nextDouble(),
						this.random.nextDouble(), this.random.nextDouble() });
		data.put("host3",
				new double[] { this.random.nextDouble(), this.random.nextDouble(),
						this.random.nextDouble(), this.random.nextDouble() });
		data.put("host4",
				new double[] { this.random.nextDouble(), this.random.nextDouble(),
						this.random.nextDouble(), this.random.nextDouble() });

		this.centrifugoServerApiClient.publication().publish(b -> b.channel("smoothie").data(data));
	}

}

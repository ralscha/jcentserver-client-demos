package ch.rasc.iss;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.reactive.function.client.support.WebClientAdapter;
import org.springframework.web.service.invoker.HttpServiceProxyFactory;

import ch.rasc.iss.IssNotifyClient.IssNotify;
import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@Service
public class IssPositionService {

	private final IssNotifyClient issNotifyClient;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public IssPositionService(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;

		WebClient issNotifyWebClient = WebClient.builder().baseUrl(IssNotifyClient.ISS_NOTIFY_URL).build();
		HttpServiceProxyFactory issNotifyClientFactory = HttpServiceProxyFactory
			.builderFor(WebClientAdapter.create(issNotifyWebClient))
			.build();
		this.issNotifyClient = issNotifyClientFactory.createClient(IssNotifyClient.class);
	}

	@Scheduled(initialDelay = 1000, fixedDelay = 3000)
	public void publish() {
		IssNotify currentLocation = this.issNotifyClient.issNow();
		if (currentLocation.message().equals("success")) {
			this.centrifugoServerApiClient.publication()
				.publish(builder -> builder.channel("iss").data(currentLocation.position()));
		}
	}

}

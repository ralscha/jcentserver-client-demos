package ch.rasc.datachannel;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class DataChannelController {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final Set<String> connectedClients = ConcurrentHashMap.newKeySet();

	public DataChannelController(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	/**
	 * Called when a peer connects. Notifies all OTHER peers about the new peer, and
	 * notifies the new peer about all existing peers.
	 */
	@PostMapping("/connect")
	public void connect(@RequestBody ConnectRequest request) {
		String clientId = request.clientId();

		// Notify all existing peers about the new peer
		Map<String, Object> joinData = Collections.singletonMap("id", clientId);
		for (String existingId : this.connectedClients) {
			this.centrifugoServerApiClient.publication()
				.publish(b -> b.channel("peer." + existingId).data(Map.of("event", "peer.connected", "id", clientId)));
		}

		// Also notify the new peer about each existing peer
		for (String existingId : this.connectedClients) {
			final String eid = existingId;
			this.centrifugoServerApiClient.publication()
				.publish(b -> b.channel("peer." + clientId).data(Map.of("event", "peer.connected", "id", eid)));
		}

		this.connectedClients.add(clientId);
	}

	/**
	 * Called when a peer disconnects. Notifies all other peers.
	 */
	@PostMapping("/disconnect")
	public void disconnect(@RequestBody ConnectRequest request) {
		String clientId = request.clientId();
		this.connectedClients.remove(clientId);

		Map<String, Object> data = Map.of("event", "peer.disconnected", "id", clientId);
		for (String peerId : this.connectedClients) {
			this.centrifugoServerApiClient.publication()
				.publish(b -> b.channel("peer." + peerId).data(data));
		}
	}

	/**
	 * Routes an SDP offer to the target peer.
	 */
	@PostMapping("/offer")
	public void offer(@RequestBody SignalingMessage request) {
		Map<String, Object> data = Map.of("event", "offer", "receiver", request.receiver(), "id", request.id(),
				"localDescription", request.localDescription());
		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("peer." + request.receiver()).data(data));
	}

	/**
	 * Routes an SDP answer to the target peer.
	 */
	@PostMapping("/answer")
	public void answer(@RequestBody SignalingMessage request) {
		Map<String, Object> data = Map.of("event", "answer", "receiver", request.receiver(), "id", request.id(),
				"localDescription", request.localDescription());
		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("peer." + request.receiver()).data(data));
	}

	/**
	 * Routes an ICE candidate to the target peer.
	 */
	@PostMapping("/ice")
	public void ice(@RequestBody IceMessage request) {
		Map<String, Object> data = Map.of("event", "ice", "receiver", request.receiver(), "id", request.id(),
				"candidate", request.candidate());
		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("peer." + request.receiver()).data(data));
	}

}

package ch.rasc.whiteboard;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class WhiteboardController {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	public WhiteboardController(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@PostMapping("/drawing")
	public void drawing(@RequestBody DrawingMessage msg) {
		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("drawing").data(msg));
	}

}

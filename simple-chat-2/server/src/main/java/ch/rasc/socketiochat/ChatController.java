package ch.rasc.socketiochat;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class ChatController {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	// userId -> username
	private final ConcurrentHashMap<String, String> connectedUsers = new ConcurrentHashMap<>();

	public ChatController(CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
	}

	@PostMapping("/add-user")
	public Map<String, Object> addUser(@RequestBody AddUserRequest request) {
		String userId = requireText(request.userId(), "userId", 64);
		String username = requireText(request.username(), "username", 32);
		this.connectedUsers.put(userId, username);

		Map<String, Object> data = Map.of("event", "user-joined", "username", username, "numUsers",
				this.connectedUsers.size());
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));

		return Map.of("event", "login", "numUsers", this.connectedUsers.size());
	}

	@PostMapping("/remove-user")
	public void removeUser(@RequestParam String userId) {
		String username = this.connectedUsers.remove(userId);
		if (username != null) {
			Map<String, Object> data = Map.of("event", "user-left", "username", username, "numUsers",
					this.connectedUsers.size());
			this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
		}
	}

	@PostMapping("/new-message")
	public void newMessage(@RequestBody NewMessageRequest request) {
		String username = requireText(request.username(), "username", 32);
		String message = requireText(request.message(), "message", 2_000);
		Map<String, Object> data = Map.of("event", "new-message", "username", username, "message", message);
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
	}

	@PostMapping("/typing")
	public void typing(@RequestBody TypingRequest request) {
		Map<String, Object> data = Map.of("event", "typing", "username",
				requireText(request.username(), "username", 32));
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
	}

	@PostMapping("/stop-typing")
	public void stopTyping(@RequestBody TypingRequest request) {
		Map<String, Object> data = Map.of("event", "stop-typing", "username",
				requireText(request.username(), "username", 32));
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
	}

	private static String requireText(String value, String field, int maxLength) {
		if (value == null || value.isBlank() || value.length() > maxLength) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					field + " must contain between 1 and " + maxLength + " characters");
		}
		return value.trim();
	}

}

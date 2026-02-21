package ch.rasc.socketiochat;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

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
		this.connectedUsers.put(request.userId(), request.username());

		Map<String, Object> data = new HashMap<>();
		data.put("event", "user-joined");
		data.put("username", request.username());
		data.put("numUsers", this.connectedUsers.size());
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));

		Map<String, Object> loginData = new HashMap<>();
		loginData.put("event", "login");
		loginData.put("numUsers", this.connectedUsers.size());
		return loginData;
	}

	@PostMapping("/remove-user")
	public void removeUser(@RequestBody RemoveUserRequest request) {
		String username = this.connectedUsers.remove(request.userId());
		if (username != null) {
			Map<String, Object> data = new HashMap<>();
			data.put("event", "user-left");
			data.put("username", username);
			data.put("numUsers", this.connectedUsers.size());
			this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
		}
	}

	@PostMapping("/new-message")
	public void newMessage(@RequestBody NewMessageRequest request) {
		Map<String, Object> data = new HashMap<>();
		data.put("event", "new-message");
		data.put("username", request.username());
		data.put("message", request.message());
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
	}

	@PostMapping("/typing")
	public void typing(@RequestBody TypingRequest request) {
		Map<String, Object> data = new HashMap<>();
		data.put("event", "typing");
		data.put("username", request.username());
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
	}

	@PostMapping("/stop-typing")
	public void stopTyping(@RequestBody TypingRequest request) {
		Map<String, Object> data = new HashMap<>();
		data.put("event", "stop-typing");
		data.put("username", request.username());
		this.centrifugoServerApiClient.publication().publish(b -> b.channel("chat").data(data));
	}

}

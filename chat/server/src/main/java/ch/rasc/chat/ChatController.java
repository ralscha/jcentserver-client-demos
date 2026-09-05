package ch.rasc.chat;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
public class ChatController {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final Algorithm algorithmHS;

	// Room names
	private final Set<String> rooms = ConcurrentHashMap.newKeySet();

	// Room name -> message cache (last 100 messages, 6 hours TTL)
	private final Map<String, Cache<String, ChatMessage>> roomMessages = new ConcurrentHashMap<>();

	// Signed-in usernames
	private final Set<String> signedInUsers = ConcurrentHashMap.newKeySet();

	public ChatController(CentrifugoServerApiClient centrifugoServerApiClient,
			CentrifugoProperties centrifugoProperties) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	/**
	 * Sign in with a username. Returns JWT token + list of existing rooms, or conflict if
	 * username is taken.
	 */
	@PostMapping("/signin")
	public Map<String, Object> signin(@RequestBody SigninRequest request) {
		String username = requireText(request.username(), "username", 32);
		if (!this.signedInUsers.add(username)) {
			return Map.of("error", "userexists");
		}

		String token = JWT.create().withSubject(username).sign(this.algorithmHS);

		return Map.of("token", token, "rooms", new ArrayList<>(this.rooms));
	}

	/**
	 * Sign out — removes the user from the signed-in set.
	 */
	@PostMapping("/signout")
	public void signout(@RequestBody SignoutRequest request) {
		this.signedInUsers.remove(request.username());
	}

	@PostMapping("/unload")
	public void unload(@RequestParam String username, @RequestParam(required = false) String room) {
		if (room != null && !room.isBlank()) {
			leaveRoom(new JoinRoomRequest(room, username));
		}
		this.signedInUsers.remove(username);
	}

	/**
	 * Create a new room. Broadcasts "room-added" to the global "rooms" channel.
	 */
	@PostMapping("/new-room")
	public void newRoom(@RequestBody RoomRequest request) {
		String room = requireText(request.room(), "room", 64);
		if (this.rooms.add(room)) {
			this.centrifugoServerApiClient.publication()
				.publish(b -> b.channel("rooms").data(Map.of("event", "room-added", "room", room)));
		}
	}

	/**
	 * Join a room. Returns existing messages. Broadcasts join message to the room
	 * channel.
	 */
	@PostMapping("/join-room")
	public List<ChatMessage> joinRoom(@RequestBody JoinRoomRequest request) {
		String room = requireText(request.room(), "room", 64);
		String username = requireText(request.username(), "username", 32);

		ChatMessage joinMsg = message(MessageType.JOIN, username, username + " has joined the room");
		storeMessage(room, joinMsg);

		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("room." + room).data(Map.of("event", "new-message", "message", joinMsg)));

		return getMessages(room);
	}

	/**
	 * Leave a room. Broadcasts leave message to the room channel.
	 */
	@PostMapping("/leave-room")
	public void leaveRoom(@RequestBody JoinRoomRequest request) {
		String room = requireText(request.room(), "room", 64);
		String username = requireText(request.username(), "username", 32);

		ChatMessage leaveMsg = message(MessageType.LEAVE, username, username + " has left the room");
		storeMessage(room, leaveMsg);

		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("room." + room).data(Map.of("event", "new-message", "message", leaveMsg)));
	}

	/**
	 * Post a message to a room. Broadcasts to the room channel.
	 */
	@PostMapping("/msg")
	public void postMessage(@RequestBody PostMessageRequest request) {
		String room = requireText(request.room(), "room", 64);
		String username = requireText(request.username(), "username", 32);
		String text = requireText(request.message(), "message", 2_000);
		ChatMessage msg = message(MessageType.MSG, username, text);
		storeMessage(room, msg);

		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("room." + room).data(Map.of("event", "new-message", "message", msg)));
	}

	private void storeMessage(String room, ChatMessage message) {
		this.roomMessages
			.computeIfAbsent(room,
					k -> Caffeine.newBuilder().expireAfterWrite(6, TimeUnit.HOURS).maximumSize(100).build())
			.put(message.id(), message);
	}

	private ChatMessage message(MessageType type, String username, String text) {
		return new ChatMessage(UUID.randomUUID().toString(), type, username, text, System.currentTimeMillis());
	}

	private List<ChatMessage> getMessages(String room) {
		Cache<String, ChatMessage> cache = this.roomMessages.get(room);
		if (cache != null) {
			return cache.asMap()
				.values()
				.stream()
				.sorted(Comparator.comparing(ChatMessage::sendDate).thenComparing(ChatMessage::id))
				.toList();
		}
		return Collections.emptyList();
	}

	/**
	 * Periodically remove rooms that have no recent messages.
	 */
	@Scheduled(fixedDelay = 21_600_000)
	public void removeOldRooms() {
		Set<String> oldRooms = new HashSet<>();
		this.roomMessages.forEach((room, cache) -> {
			cache.cleanUp();
			if (cache.estimatedSize() == 0) {
				oldRooms.add(room);
			}
		});

		if (!oldRooms.isEmpty()) {
			oldRooms.forEach(this.roomMessages::remove);
			oldRooms.forEach(this.rooms::remove);

			this.centrifugoServerApiClient.publication()
				.publish(b -> b.channel("rooms").data(Map.of("event", "rooms-removed", "rooms", oldRooms)));
		}
	}

	private static String requireText(String value, String field, int maxLength) {
		if (value == null || value.isBlank() || value.length() > maxLength) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
					field + " must contain between 1 and " + maxLength + " characters");
		}
		return value.trim();
	}

}

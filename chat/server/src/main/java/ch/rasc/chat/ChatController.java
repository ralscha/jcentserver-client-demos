package ch.rasc.chat;

import java.nio.charset.StandardCharsets;
import java.security.Key;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;

@RestController
public class ChatController {

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	private final Key centrifugoHmacShaKey;

	// Room names
	private final Set<String> rooms = ConcurrentHashMap.newKeySet();

	// Room name -> message cache (last 100 messages, 6 hours TTL)
	private final Map<String, Cache<Long, ChatMessage>> roomMessages = new ConcurrentHashMap<>();

	// Signed-in usernames
	private final Set<String> signedInUsers = ConcurrentHashMap.newKeySet();

	public ChatController(CentrifugoServerApiClient centrifugoServerApiClient,
			CentrifugoProperties centrifugoProperties) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
		this.centrifugoHmacShaKey = Keys
			.hmacShaKeyFor(centrifugoProperties.hmacSecret().getBytes(StandardCharsets.UTF_8));
	}

	/**
	 * Sign in with a username. Returns JWT token + list of existing rooms, or conflict if
	 * username is taken.
	 */
	@PostMapping("/signin")
	public Map<String, Object> signin(@RequestBody SigninRequest request) {
		if (this.signedInUsers.contains(request.username())) {
			return Map.of("error", "userexists");
		}
		this.signedInUsers.add(request.username());

		String token = Jwts.builder()
			.subject(request.username())
			.signWith(this.centrifugoHmacShaKey)
			.compact();

		return Map.of("token", token, "rooms", new ArrayList<>(this.rooms));
	}

	/**
	 * Sign out — removes the user from the signed-in set.
	 */
	@PostMapping("/signout")
	public void signout(@RequestBody SignoutRequest request) {
		this.signedInUsers.remove(request.username());
	}

	/**
	 * Create a new room. Broadcasts "room-added" to the global "rooms" channel.
	 */
	@PostMapping("/new-room")
	public void newRoom(@RequestBody RoomRequest request) {
		if (this.rooms.add(request.room())) {
			this.centrifugoServerApiClient.publication()
				.publish(b -> b.channel("rooms").data(Map.of("event", "room-added", "room", request.room())));
		}
	}

	/**
	 * Join a room. Returns existing messages. Broadcasts join message to the room channel.
	 */
	@PostMapping("/join-room")
	public List<ChatMessage> joinRoom(@RequestBody JoinRoomRequest request) {
		String room = request.room();
		String username = request.username();

		ChatMessage joinMsg = new ChatMessage(MessageType.JOIN, username, username + " has joined the room",
				System.currentTimeMillis());
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
		String room = request.room();
		String username = request.username();

		ChatMessage leaveMsg = new ChatMessage(MessageType.LEAVE, username, username + " has left the room",
				System.currentTimeMillis());
		storeMessage(room, leaveMsg);

		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("room." + room).data(Map.of("event", "new-message", "message", leaveMsg)));
	}

	/**
	 * Post a message to a room. Broadcasts to the room channel.
	 */
	@PostMapping("/msg")
	public void postMessage(@RequestBody PostMessageRequest request) {
		String room = request.room();
		ChatMessage msg = new ChatMessage(MessageType.MSG, request.username(), request.message(),
				System.currentTimeMillis());
		storeMessage(room, msg);

		this.centrifugoServerApiClient.publication()
			.publish(b -> b.channel("room." + room).data(Map.of("event", "new-message", "message", msg)));
	}

	private void storeMessage(String room, ChatMessage message) {
		this.roomMessages.computeIfAbsent(room,
				k -> Caffeine.newBuilder().expireAfterWrite(6, TimeUnit.HOURS).maximumSize(100).build())
			.put(message.sendDate(), message);
	}

	private List<ChatMessage> getMessages(String room) {
		Cache<Long, ChatMessage> cache = this.roomMessages.get(room);
		if (cache != null) {
			return cache.asMap()
				.values()
				.stream()
				.sorted(Comparator.comparing(ChatMessage::sendDate))
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

}

package ch.rasc.demo.snake;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;

@RestController
@CrossOrigin
public class SnakeController {

	private static final Logger log = LoggerFactory.getLogger(SnakeController.class);

	private final Map<String, Snake> snakes = new ConcurrentHashMap<>();

	private final Map<String, String> playerSnakeMap = new ConcurrentHashMap<>();

	private final Algorithm algorithmHS;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	SnakeController(CentrifugoProperties centrifugoProperties, CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoServerApiClient = centrifugoServerApiClient;
		this.algorithmHS = Algorithm.HMAC512(centrifugoProperties.hmacSecret());
	}

	@PostMapping("/join")
	public synchronized JoinGameResponse joinGame(@RequestBody JoinGameRequest request) {
		String playerId = requirePlayerId(request.playerId());
		String previousSnakeId = this.playerSnakeMap.remove(playerId);
		if (previousSnakeId != null) {
			removeSnake(previousSnakeId);
		}
		Snake newSnake = new Snake();
		this.snakes.put(newSnake.getId(), newSnake);
		this.playerSnakeMap.put(playerId, newSnake.getId());

		SnakeMessage joinMsg = SnakeMessage.createJoinMessage(createJoinData());
		publishToChannel("snake", joinMsg);
		return new JoinGameResponse(newSnake.getId());
	}

	@PostMapping("/leave")
	@ResponseStatus(code = HttpStatus.NO_CONTENT)
	public synchronized void leaveGame(@RequestParam String playerId) {
		playerId = requirePlayerId(playerId);
		String snakeId = this.playerSnakeMap.remove(playerId);
		if (snakeId != null) {
			removeSnake(snakeId);
		}
	}

	@PostMapping("/direction")
	@ResponseStatus(code = HttpStatus.NO_CONTENT)
	public void changeDirection(@RequestBody DirectionChangeRequest request) {
		String snakeId = this.playerSnakeMap.get(requirePlayerId(request.playerId()));
		if (snakeId != null) {
			changeDirection(snakeId, request.direction());
		}
	}

	@GetMapping("/token")
	public String token() {
		return JWT.create().withSubject("snake").withClaim("channels", List.of("snake")).sign(this.algorithmHS);
	}

	@GetMapping("/test")
	public String test() {
		return "Server is working";
	}

	private void removeSnake(String snakeId) {
		this.snakes.remove(snakeId);
		SnakeMessage leaveMsg = SnakeMessage.createLeaveMessage(snakeId);
		publishToChannel("snake", leaveMsg);
	}

	@Scheduled(fixedRate = 100)
	public void tick() {
		Collection<Snake> allSnakes = getSnakes();
		List<Map<String, Object>> updateData = new ArrayList<>();
		List<String> deadSnakes = new ArrayList<>();
		Set<String> killerSnakes = new LinkedHashSet<>();

		for (Snake snake : allSnakes) {
			boolean wasDead = snake.isDead();

			String killerId = snake.update(allSnakes);

			Map<String, Object> locationsData = snake.getLocationsData();
			if (locationsData != null) {
				updateData.add(locationsData);
			}

			if (!wasDead && snake.isDead()) {
				deadSnakes.add(snake.getId());
			}

			if (killerId != null) {
				killerSnakes.add(killerId);
			}
		}

		if (!updateData.isEmpty()) {
			SnakeMessage updateMsg = SnakeMessage.createUpdateMessage(updateData);
			publishToChannel("snake", updateMsg);
		}

		deadSnakes.forEach(id -> publishToChannel("snake", SnakeMessage.createDeadMessage(id)));
		killerSnakes.forEach(id -> publishToChannel("snake", SnakeMessage.createKillMessage(id)));
	}

	private Collection<Snake> getSnakes() {
		return List.copyOf(this.snakes.values());
	}

	public List<Map<String, Object>> createJoinData() {
		List<Map<String, Object>> result = new ArrayList<>();
		for (Snake snake : getSnakes()) {
			Map<String, Object> es = new HashMap<>();
			es.put("id", snake.getId());
			es.put("color", snake.getHexColor());

			List<Location> locations = new ArrayList<>();
			locations.add(snake.getHead());
			locations.addAll(snake.getTail());
			es.put("body", locations);

			result.add(es);
		}
		return result;
	}

	private void changeDirection(String id, String message) {
		Snake snake = this.snakes.get(id);
		if (snake != null) {
			if ("west".equals(message)) {
				snake.setDirection(Direction.WEST);
			}
			else if ("north".equals(message)) {
				snake.setDirection(Direction.NORTH);
			}
			else if ("east".equals(message)) {
				snake.setDirection(Direction.EAST);
			}
			else if ("south".equals(message)) {
				snake.setDirection(Direction.SOUTH);
			}
		}
	}

	private void publishToChannel(String channel, SnakeMessage message) {
		try {
			this.centrifugoServerApiClient.publication().publish(p -> p.channel(channel).data(message));
		}
		catch (Exception e) {
			log.warn("Failed to publish message", e);
		}
	}

	private static String requirePlayerId(String playerId) {
		if (playerId == null || playerId.isBlank() || playerId.length() > 64) {
			throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "invalid playerId");
		}
		return playerId;
	}

	public record DirectionChangeRequest(String playerId, String direction) {
	}

	public record JoinGameRequest(String playerId) {
	}

	public record JoinGameResponse(String snakeId) {
	}

}

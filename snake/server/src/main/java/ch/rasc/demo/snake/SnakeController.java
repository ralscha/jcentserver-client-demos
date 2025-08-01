package ch.rasc.demo.snake;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.ConcurrentHashMap;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import com.auth0.jwt.JWT;
import com.auth0.jwt.algorithms.Algorithm;

import ch.rasc.jcentserverclient.CentrifugoServerApiClient;
import jakarta.annotation.PreDestroy;

@RestController
@CrossOrigin
public class SnakeController {

	private final Map<String, Snake> snakes = new ConcurrentHashMap<>();

	private final Map<String, String> playerSnakeMap = new ConcurrentHashMap<>();

	private Timer gameTimer;

	private final Algorithm algorithmHS;

	private final CentrifugoProperties centrifugoProperties;

	private final CentrifugoServerApiClient centrifugoServerApiClient;

	SnakeController(CentrifugoProperties centrifugoProperties,
			CentrifugoServerApiClient centrifugoServerApiClient) {
		this.centrifugoProperties = centrifugoProperties;
		this.centrifugoServerApiClient = centrifugoServerApiClient;
		this.algorithmHS = Algorithm.HMAC512(this.centrifugoProperties.hmacSecret());
	}

	@PreDestroy
	public void cleanup() {
		if (this.gameTimer != null) {
			this.gameTimer.cancel();
			this.gameTimer = null;
		}
	}

	@PostMapping("/join")
	@ResponseStatus(code = HttpStatus.NO_CONTENT)
	public void joinGame(@RequestBody JoinGameRequest request) {
		Snake newSnake = new Snake();
		if (this.snakes.isEmpty()) {
			startTimer();
		}
		this.snakes.put(newSnake.getId(), newSnake);
		this.playerSnakeMap.put(request.playerId(), newSnake.getId());

		SnakeMessage joinMsg = SnakeMessage.createJoinMessage(createJoinData());
		publishToChannel("snake", joinMsg);
	}

	@PostMapping("/leave")
	@ResponseStatus(code = HttpStatus.NO_CONTENT)
	public void leaveGame(@RequestBody JoinGameRequest request) {
		String snakeId = this.playerSnakeMap.remove(request.playerId());
		if (snakeId != null) {
			removeSnake(snakeId);
		}
	}

	@PostMapping("/direction")
	@ResponseStatus(code = HttpStatus.NO_CONTENT)
	public void changeDirection(@RequestBody DirectionChangeRequest request) {
		String snakeId = this.playerSnakeMap.get(request.playerId());
		if (snakeId != null) {
			changeDirection(snakeId, request.direction());
		}
	}

	@GetMapping("/token")
	public String token() {
		return JWT.create().withSubject("snake").withClaim("channels", List.of("snake"))
				.sign(this.algorithmHS);
	}

	@GetMapping("/test")
	public String test() {
		return "Server is working";
	}

	private void removeSnake(String snakeId) {
		this.snakes.remove(snakeId);
		if (this.snakes.isEmpty()) {
			if (this.gameTimer != null) {
				this.gameTimer.cancel();
				this.gameTimer = null;
			}
		}

		SnakeMessage leaveMsg = SnakeMessage.createLeaveMessage(snakeId);
		publishToChannel("snake", leaveMsg);
	}

	public void startTimer() {
		this.gameTimer = new Timer(SnakeController.class.getSimpleName() + " Timer");
		this.gameTimer.scheduleAtFixedRate(new TimerTask() {
			@Override
			public void run() {
				tick();
			}
		}, 100, 100);
	}

	public void tick() {
		Collection<Snake> allSnakes = getSnakes();
		List<Map<String, Object>> updateData = new ArrayList<>();
		List<String> deadSnakes = new ArrayList<>();
		List<String> killerSnakes = new ArrayList<>();

		for (Snake snake : allSnakes) {
			boolean wasDead = snake.isDead();
			boolean hadKills = snake.hasKilled();

			snake.update(allSnakes);

			Map<String, Object> locationsData = snake.getLocationsData();
			if (locationsData != null) {
				updateData.add(locationsData);
			}

			if (!wasDead && snake.isDead()) {
				deadSnakes.add(snake.getId());
			}

			if (!hadKills && snake.hasKilled()) {
				killerSnakes.add(snake.getId());
			}
		}

		if (!updateData.isEmpty()) {
			SnakeMessage updateMsg = SnakeMessage.createUpdateMessage(updateData);
			publishToChannel("snake", updateMsg);
		}

		if (!deadSnakes.isEmpty()) {
			SnakeMessage deadMsg = SnakeMessage.createDeadMessage();
			publishToChannel("snake", deadMsg);
		}

		if (!killerSnakes.isEmpty()) {
			SnakeMessage killMsg = SnakeMessage.createKillMessage();
			publishToChannel("snake", killMsg);
		}
	}

	private Collection<Snake> getSnakes() {
		return Collections.unmodifiableCollection(this.snakes.values());
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
			this.centrifugoServerApiClient.publication()
					.publish(p -> p.channel(channel).data(message));
		}
		catch (Exception e) {
			System.err.println("Failed to publish message: " + e.getMessage());
		}
	}

	public record DirectionChangeRequest(String playerId, String direction) {
	}

	public record JoinGameRequest(String playerId) {
	}

}

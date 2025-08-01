package ch.rasc.demo.snake;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class Snake {

	private static final int DEFAULT_LENGTH = 5;

	private final String id;

	private Direction direction;

	private int length = DEFAULT_LENGTH;

	private Location head;

	private Location lastHead;

	private final Deque<Location> tail = new ArrayDeque<>();

	private final String hexColor;

	public Snake() {
		this.id = UUID.randomUUID().toString();
		this.hexColor = SnakeUtils.getRandomHexColor();
		resetState();
	}

	private void resetState() {
		this.direction = Direction.NONE;
		this.head = SnakeUtils.getRandomLocation();
		this.tail.clear();
		this.length = DEFAULT_LENGTH;
	}

	private synchronized void kill() {
		System.out.println("Snake " + this.id + " was killed! Resetting state.");
		resetState();
	}

	private synchronized void reward() {
		this.length++;
	}

	public synchronized void update(Collection<Snake> snakes) {
		Location nextLocation = this.head.getAdjacentLocation(this.direction);
		if (nextLocation.x >= SnakeUtils.PLAYFIELD_WIDTH) {
			nextLocation.x = 0;
		}
		if (nextLocation.y >= SnakeUtils.PLAYFIELD_HEIGHT) {
			nextLocation.y = 0;
		}
		if (nextLocation.x < 0) {
			nextLocation.x = SnakeUtils.PLAYFIELD_WIDTH;
		}
		if (nextLocation.y < 0) {
			nextLocation.y = SnakeUtils.PLAYFIELD_HEIGHT;
		}
		if (this.direction != Direction.NONE) {
			this.tail.addFirst(this.head);
			if (this.tail.size() > this.length) {
				this.tail.removeLast();
			}
			this.head = nextLocation;
		}

		handleCollisions(snakes);
	}

	private void handleCollisions(Collection<Snake> snakes) {
		for (Snake snake : snakes) {
			boolean headCollision = this.id != snake.id && snake.getHead().equals(this.head);
			boolean tailCollision = snake.getTail().contains(this.head);
			if (headCollision || tailCollision) {
				kill();
				if (this.id != snake.id) {
					snake.reward();
				}
			}
		}
	}

	public synchronized Location getHead() {
		return this.head;
	}

	public synchronized Collection<Location> getTail() {
		return this.tail;
	}

	public synchronized void setDirection(Direction direction) {
		this.direction = direction;
	}

	public synchronized Map<String, Object> getLocationsData() {
		// Only create location data if it changed
		if (this.lastHead == null || !this.lastHead.equals(this.head)) {
			this.lastHead = this.head;

			List<Location> locations = new ArrayList<>();
			locations.add(this.head);
			locations.addAll(this.tail);

			Map<String, Object> es = new HashMap<>();
			es.put("id", getId());
			es.put("body", locations);
			return es;
		}

		return null;
	}

	public String getId() {
		return this.id;
	}

	public String getHexColor() {
		return this.hexColor;
	}

	public boolean isDead() {
		return this.direction == Direction.NONE;
	}

	public boolean hasKilled() {
		return this.length > DEFAULT_LENGTH;
	}

}

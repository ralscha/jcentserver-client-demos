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
		this.lastHead = null;
		this.tail.clear();
		this.length = DEFAULT_LENGTH;
	}

	private synchronized void kill() {
		resetState();
	}

	private synchronized void reward() {
		this.length++;
	}

	public synchronized String update(Collection<Snake> snakes) {
		Location nextLocation = this.head.getAdjacentLocation(this.direction);
		if (nextLocation.x >= SnakeUtils.PLAYFIELD_WIDTH) {
			nextLocation.x = 0;
		}
		if (nextLocation.y >= SnakeUtils.PLAYFIELD_HEIGHT) {
			nextLocation.y = 0;
		}
		if (nextLocation.x < 0) {
			nextLocation.x = SnakeUtils.PLAYFIELD_WIDTH - SnakeUtils.GRID_SIZE;
		}
		if (nextLocation.y < 0) {
			nextLocation.y = SnakeUtils.PLAYFIELD_HEIGHT - SnakeUtils.GRID_SIZE;
		}
		if (this.direction != Direction.NONE) {
			this.tail.addFirst(this.head);
			if (this.tail.size() > this.length) {
				this.tail.removeLast();
			}
			this.head = nextLocation;
		}

		return handleCollisions(snakes);
	}

	private String handleCollisions(Collection<Snake> snakes) {
		for (Snake snake : snakes) {
			boolean headCollision = !this.id.equals(snake.id) && snake.getHead().equals(this.head);
			boolean tailCollision = snake.getTail().contains(this.head);
			if (headCollision || tailCollision) {
				kill();
				if (!this.id.equals(snake.id)) {
					snake.reward();
					return snake.id;
				}
				return null;
			}
		}
		return null;
	}

	public synchronized Location getHead() {
		return this.head;
	}

	public synchronized Collection<Location> getTail() {
		return List.copyOf(this.tail);
	}

	public synchronized void setDirection(Direction direction) {
		if ((this.direction == Direction.NORTH && direction == Direction.SOUTH)
				|| (this.direction == Direction.SOUTH && direction == Direction.NORTH)
				|| (this.direction == Direction.EAST && direction == Direction.WEST)
				|| (this.direction == Direction.WEST && direction == Direction.EAST)) {
			return;
		}
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

	public synchronized boolean isDead() {
		return this.direction == Direction.NONE;
	}

}

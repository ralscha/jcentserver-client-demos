package ch.rasc.demo.snake;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.Test;

class SnakeTest {

	@Test
	void randomLocationsStayOnTheGridAndInsideThePlayfield() {
		for (int i = 0; i < 10_000; i++) {
			Location location = SnakeUtils.getRandomLocation();
			assertThat(location.x).isBetween(0, SnakeUtils.PLAYFIELD_WIDTH - SnakeUtils.GRID_SIZE);
			assertThat(location.y).isBetween(0, SnakeUtils.PLAYFIELD_HEIGHT - SnakeUtils.GRID_SIZE);
			assertThat(location.x % SnakeUtils.GRID_SIZE).isZero();
			assertThat(location.y % SnakeUtils.GRID_SIZE).isZero();
		}
	}

	@Test
	void wrapsAtTheLeftAndTopEdges() {
		Snake snake = new Snake();
		snake.getHead().x = 0;
		snake.getHead().y = 0;

		snake.setDirection(Direction.WEST);
		snake.update(List.of(snake));
		assertThat(snake.getHead().x).isEqualTo(SnakeUtils.PLAYFIELD_WIDTH - SnakeUtils.GRID_SIZE);

		snake.setDirection(Direction.NORTH);
		snake.update(List.of(snake));
		assertThat(snake.getHead().y).isEqualTo(SnakeUtils.PLAYFIELD_HEIGHT - SnakeUtils.GRID_SIZE);
	}

	@Test
	void rejectsAnImmediateReverseTurn() {
		Snake snake = new Snake();
		snake.getHead().x = 100;
		snake.getHead().y = 100;
		snake.setDirection(Direction.EAST);
		snake.setDirection(Direction.WEST);

		snake.update(List.of(snake));

		assertThat(snake.getHead()).isEqualTo(new Location(110, 100));
	}

	@Test
	void reportsTheSnakeThatWonAHeadCollision() {
		Snake victim = new Snake();
		Snake winner = new Snake();
		victim.getHead().x = 100;
		victim.getHead().y = 100;
		winner.getHead().x = 110;
		winner.getHead().y = 100;
		victim.setDirection(Direction.EAST);

		String killerId = victim.update(List.of(victim, winner));

		assertThat(killerId).isEqualTo(winner.getId());
		assertThat(victim.isDead()).isTrue();
	}

}

package ch.rasc.demo.snake;

import com.fasterxml.jackson.annotation.JsonIgnore;

public class Location {

	public int x;

	public int y;

	public Location(int x, int y) {
		this.x = x;
		this.y = y;
	}

	@JsonIgnore
	public Location getAdjacentLocation(Direction direction) {
		switch (direction) {
			case NORTH:
				return new Location(this.x, this.y - SnakeUtils.GRID_SIZE);
			case SOUTH:
				return new Location(this.x, this.y + SnakeUtils.GRID_SIZE);
			case EAST:
				return new Location(this.x + SnakeUtils.GRID_SIZE, this.y);
			case WEST:
				return new Location(this.x - SnakeUtils.GRID_SIZE, this.y);
			case NONE:
				// fall through
			default:
				return this;
		}
	}

	@Override
	public boolean equals(Object o) {
		if (this == o) {
			return true;
		}
		if (o == null || getClass() != o.getClass()) {
			return false;
		}

		Location location = (Location) o;

		if (this.x != location.x) {
			return false;
		}
		if (this.y != location.y) {
			return false;
		}

		return true;
	}

	@Override
	public int hashCode() {
		int result = this.x;
		result = 31 * result + this.y;
		return result;
	}

}
